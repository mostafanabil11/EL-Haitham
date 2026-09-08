import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessCode, AccessCodeDocument } from './schemas/access-code.schema';
import { Bundle, BundleDocument } from './schemas/bundle.schema';
import { Lecture, LectureDocument } from '@/content/schemas/lecture.schema';
import { EnrollmentsService } from './enrollments.service';
import { generateCode, normalizeCode, CODE_ALPHABET } from './utils/code-generator';
import { ApiResponse } from '@/common/types/api-response';
import { GenerateCodesDto } from './dto';

@Injectable()
export class AccessCodesService {
  private readonly logger = new Logger(AccessCodesService.name);

  constructor(
    @InjectModel(AccessCode.name) private codeModel: Model<AccessCodeDocument>,
    @InjectModel(Bundle.name) private bundleModel: Model<BundleDocument>,
    @InjectModel(Lecture.name) private lectureModel: Model<LectureDocument>,
    private enrollmentsService: EnrollmentsService,
  ) {}

  /**
   * REDEMPTION. The one operation in this codebase where a race would cost
   * real money, so the mechanism is worth stating plainly.
   *
   * The claim is a single `findOneAndUpdate` filtered on `status: 'unused'`.
   * MongoDB guarantees a single-document update is atomic, so of two students
   * submitting the same code in the same millisecond exactly one matches the
   * filter and the other gets null. There is no read-then-write window to lose.
   *
   * Granting the enrollments happens *after* the claim rather than inside a
   * transaction. That is deliberate: the unique index on {user, lecture} makes
   * granting idempotent, so the worst case — process dies between claim and
   * grant — is repaired by the student simply trying again, since the code is
   * already theirs by then and re-granting is a no-op. A transaction would
   * also work, but it would make the whole flow require a replica set for a
   * guarantee the index already provides.
   *
   * If the grant fails for a reason that is not retryable, the claim is rolled
   * back so the code does not die holding nothing.
   */
  async redeem(rawCode: string, userId: Types.ObjectId): Promise<ApiResponse<unknown>> {
    const code = normalizeCode(rawCode);

    // Rejected before touching the database. Saying "this is not a valid code"
    // is both faster and more useful than "code not found" when someone has
    // typed O for 0.
    if (!code) {
      throw new BadRequestException(
        `صيغة الكود غير صحيحة. الكود مكوّن من 12 حرفاً ورقماً، ولا يحتوي على الأحرف O أو I أو L أو الأرقام 0 أو 1.`,
      );
    }

    const claimed = await this.codeModel.findOneAndUpdate(
      { code, status: 'unused' },
      { $set: { status: 'redeemed', redeemedBy: userId, redeemedAt: new Date() } },
      { new: true },
    );

    if (!claimed) {
      // The claim failed. Work out why, because "invalid code" for all four
      // cases is what turns a self-service action into a WhatsApp message.
      await this.explainFailedClaim(code, userId);
    }

    // An expired code should never have been claimable. Checking after the
    // claim rather than folding `expiresAt` into the filter keeps the filter
    // to the single condition that must be atomic, and the claim is released
    // immediately below.
    if (claimed!.expiresAt && claimed!.expiresAt <= new Date()) {
      await this.codeModel.updateOne(
        { _id: claimed!._id },
        { $set: { status: 'unused', redeemedBy: null, redeemedAt: null } },
      );
      throw new BadRequestException('انتهت صلاحية هذا الكود. تواصل مع المدرس.');
    }

    try {
      const lectureIds = await this.resolveTargets(claimed!);

      const result = await this.enrollmentsService.grant(userId, lectureIds, {
        source: 'code',
        accessCode: claimed!._id,
        bundle: claimed!.bundle ?? undefined,
      });

      // Every lecture in the code was already owned. The student gained
      // nothing, so the code is released rather than consumed — otherwise a
      // mistakenly re-sent code is destroyed and the teacher has to issue
      // another one.
      if (result.granted.length === 0) {
        await this.codeModel.updateOne(
          { _id: claimed!._id },
          { $set: { status: 'unused', redeemedBy: null, redeemedAt: null } },
        );
        throw new ConflictException('لديك بالفعل كل المحاضرات في هذا الكود.');
      }

      const lectures = await this.lectureModel
        .find({ _id: { $in: result.granted } }, 'titleAr slug grade')
        .lean();

      return {
        success: true,
        message:
          result.alreadyHeld.length > 0
            ? `تم تفعيل ${result.granted.length} محاضرة. ${result.alreadyHeld.length} كانت لديك بالفعل.`
            : `تم تفعيل ${result.granted.length} محاضرة بنجاح.`,
        data: { granted: lectures, alreadyHeldCount: result.alreadyHeld.length },
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;

      // Release the claim so the code is not left burned with nothing granted.
      await this.codeModel.updateOne(
        { _id: claimed!._id },
        { $set: { status: 'unused', redeemedBy: null, redeemedAt: null } },
      );
      this.logger.error(`Redemption rolled back for ${code}: ${(error as Error).message}`);
      throw error;
    }
  }

  // Always throws. Split out so redeem() reads as one path.
  private async explainFailedClaim(code: string, userId: Types.ObjectId): Promise<never> {
    const existing = await this.codeModel.findOne({ code });

    if (!existing) {
      throw new NotFoundException('هذا الكود غير موجود. تأكد من كتابته بشكل صحيح.');
    }

    if (existing.status === 'revoked') {
      throw new BadRequestException('تم إلغاء هذا الكود. تواصل مع المدرس.');
    }

    if (existing.status === 'redeemed') {
      // Distinguishing "you already used this" from "someone else used this"
      // matters: the first is reassurance, the second is the teacher's signal
      // that a code leaked.
      if (existing.redeemedBy?.equals(userId)) {
        throw new ConflictException('لقد استخدمت هذا الكود بالفعل. المحاضرة متاحة في حسابك.');
      }
      throw new ConflictException('تم استخدام هذا الكود من قبل حساب آخر. تواصل مع المدرس.');
    }

    throw new BadRequestException('لا يمكن استخدام هذا الكود.');
  }

  private async resolveTargets(code: AccessCodeDocument): Promise<Types.ObjectId[]> {
    if (code.targetKind === 'lecture') {
      if (!code.lecture) throw new BadRequestException('هذا الكود غير مرتبط بمحاضرة.');
      return [code.lecture];
    }

    const bundle = await this.bundleModel.findById(code.bundle);
    if (!bundle) throw new NotFoundException('الباقة غير موجودة.');
    if (bundle.lectures.length === 0) throw new BadRequestException('هذه الباقة فارغة.');

    return bundle.lectures;
  }

  // --- Admin ---

  async generate(dto: GenerateCodesDto): Promise<ApiResponse<unknown>> {
    if (dto.targetKind === 'lecture') {
      const lecture = await this.lectureModel.findById(dto.targetId);
      if (!lecture) throw new NotFoundException('المحاضرة غير موجودة');
    } else {
      const bundle = await this.bundleModel.findById(dto.targetId);
      if (!bundle) throw new NotFoundException('الباقة غير موجودة');
    }

    const batchId = dto.batchId ?? `B-${Date.now().toString(36).toUpperCase()}`;
    const targetId = new Types.ObjectId(dto.targetId);

    const created: string[] = [];

    // Generated one at a time with a retry rather than as one insertMany:
    // the unique index is the authority on collisions, and a single duplicate
    // in a batch of 50 would abort the whole insert. At 31^12 a collision is
    // vanishingly unlikely, but "unlikely" is not a reason to lose 49 codes.
    for (let i = 0; i < dto.count; i++) {
      let attempts = 0;
      for (;;) {
        try {
          const doc = await this.codeModel.create({
            code: generateCode(),
            targetKind: dto.targetKind,
            lecture: dto.targetKind === 'lecture' ? targetId : null,
            bundle: dto.targetKind === 'bundle' ? targetId : null,
            batchId,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            note: dto.note ?? null,
          });
          created.push(doc.code);
          break;
        } catch (error: any) {
          if (error?.code === 11000 && ++attempts < 5) continue;
          throw error;
        }
      }
    }

    return {
      success: true,
      message: `تم إنشاء ${created.length} كود`,
      data: { batchId, codes: created },
    };
  }

  async list(query: {
    status?: string;
    batchId?: string;
    lectureId?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.batchId) filter.batchId = query.batchId;
    if (query.lectureId && Types.ObjectId.isValid(query.lectureId)) {
      filter.lecture = new Types.ObjectId(query.lectureId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [items, total] = await Promise.all([
      this.codeModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('lecture', 'titleAr slug')
        .populate('bundle', 'titleAr slug')
        .populate('redeemedBy', 'name phone')
        .lean(),
      this.codeModel.countDocuments(filter),
    ]);

    return {
      success: true,
      message: 'Codes retrieved',
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async revoke(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('معرّف غير صحيح');

    const code = await this.codeModel.findById(id);
    if (!code) throw new NotFoundException('الكود غير موجود');

    // Revoking a redeemed code does NOT withdraw the access it granted —
    // that would silently take a lecture away from someone who paid for it.
    // The enrollment is revoked separately and explicitly.
    code.status = 'revoked';
    await code.save();

    return {
      success: true,
      message:
        code.redeemedBy != null
          ? 'تم إلغاء الكود. لاحظ أن اشتراك الطالب ما زال فعّالاً — أوقفه من صفحة الاشتراكات إذا لزم.'
          : 'تم إلغاء الكود',
      data: code,
    };
  }

  async revokeBatch(batchId: string) {
    const result = await this.codeModel.updateMany(
      { batchId, status: 'unused' },
      { $set: { status: 'revoked' } },
    );

    return {
      success: true,
      message: `تم إلغاء ${result.modifiedCount} كود غير مستخدم من الدفعة`,
      data: { revoked: result.modifiedCount },
    };
  }

  // Exposed so PurchaseRequestsService can link the code it just minted back
  // to the request, without reaching into this service's private model.
  async findByCode(code: string): Promise<AccessCodeDocument | null> {
    return this.codeModel.findOne({ code });
  }

  get alphabet() {
    return CODE_ALPHABET;
  }
}
