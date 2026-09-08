import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PurchaseRequest, PurchaseRequestDocument } from './schemas/purchase-request.schema';
import { Counter, CounterDocument } from './schemas/counter.schema';
import { Bundle, BundleDocument } from './schemas/bundle.schema';
import { Lecture, LectureDocument } from '@/content/schemas/lecture.schema';
import { User, UserDocument } from '@/auth/schemas/user.schema';
import { AccessCodesService } from './access-codes.service';
import { SettingsService } from '@/settings/settings.service';
import { whatsappLink } from '@/common/utils/phone.util';
import { ApiResponse } from '@/common/types/api-response';
import { CreatePurchaseRequestDto } from './dto';

@Injectable()
export class PurchaseRequestsService {
  constructor(
    @InjectModel(PurchaseRequest.name) private requestModel: Model<PurchaseRequestDocument>,
    @InjectModel(Counter.name) private counterModel: Model<CounterDocument>,
    @InjectModel(Bundle.name) private bundleModel: Model<BundleDocument>,
    @InjectModel(Lecture.name) private lectureModel: Model<LectureDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private accessCodesService: AccessCodesService,
    private settingsService: SettingsService,
  ) {}

  // Single-document $inc with upsert — Mongo makes that atomic, so two
  // students pressing buy in the same millisecond still get distinct numbers
  // without any application-level locking.
  private async nextRequestNumber(): Promise<string> {
    const now = new Date();
    const key = `pr-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const counter = await this.counterModel.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );

    // key is "pr-YYYYMM"; slice(5) is already YYMM. Slicing again dropped the
    // year and produced "R-09-0001", which would collide with the same month
    // next year — and requestNumber is uniquely indexed, so that collision
    // would surface as a failed purchase twelve months from now.
    const yymm = key.slice(5);
    return `R-${yymm}-${String(counter.seq).padStart(4, '0')}`;
  }

  async create(userId: Types.ObjectId, dto: CreatePurchaseRequestDto): Promise<ApiResponse<unknown>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('الحساب غير موجود');

    const targetId = new Types.ObjectId(dto.targetId);

    let title: string;
    let price: number;

    if (dto.targetKind === 'lecture') {
      const lecture = await this.lectureModel.findById(targetId);
      if (!lecture || !lecture.isPublished || lecture.isArchived) {
        throw new NotFoundException('المحاضرة غير متاحة');
      }
      title = lecture.titleAr;
      price = lecture.priceMinorUnits;
    } else {
      const bundle = await this.bundleModel.findById(targetId);
      if (!bundle || !bundle.isPublished || bundle.isArchived) {
        throw new NotFoundException('الباقة غير متاحة');
      }
      title = bundle.titleAr;
      price = bundle.priceMinorUnits;
    }

    // Reuse an open request for the same thing rather than stacking duplicates
    // — a student who taps the button three times should not create three rows
    // for the teacher to reconcile.
    const existing = await this.requestModel.findOne({
      user: userId,
      status: 'pending',
      ...(dto.targetKind === 'lecture' ? { lecture: targetId } : { bundle: targetId }),
    });

    const request =
      existing ??
      (await this.requestModel.create({
        requestNumber: await this.nextRequestNumber(),
        user: userId,
        targetKind: dto.targetKind,
        lecture: dto.targetKind === 'lecture' ? targetId : null,
        bundle: dto.targetKind === 'bundle' ? targetId : null,
        // Snapshotted: a later price change must not alter what this student
        // was quoted before they paid.
        priceMinorUnits: price,
        phone: user.phone,
        titleSnapshot: title,
      }));

    const { data: settings } = await this.settingsService.getPublicSettings();
    const amount = (request.priceMinorUnits / 100).toFixed(0);

    // The request number is the whole point of this step: it turns "someone
    // sent me 75 pounds" into a row the teacher can close out in one click.
    const message =
      `السلام عليكم، أريد الاشتراك في:\n${request.titleSnapshot}\n` +
      `السعر: ${amount} ج.م\nرقم الطلب: ${request.requestNumber}`;

    return {
      success: true,
      message: 'تم إنشاء الطلب',
      data: {
        requestNumber: request.requestNumber,
        priceMinorUnits: request.priceMinorUnits,
        titleSnapshot: request.titleSnapshot,
        whatsappUrl: settings?.whatsappNumber
          ? whatsappLink(settings.whatsappNumber, message)
          : null,
      },
    };
  }

  async listMine(userId: Types.ObjectId) {
    const requests = await this.requestModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return { success: true, message: 'Requests retrieved', data: requests };
  }

  // --- Admin ---

  async list(query: { status?: string; page?: number; limit?: number }) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;

    const page = query.page ?? 1;
    const limit = query.limit ?? 30;

    const [items, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name phone parentPhone grade')
        .populate('issuedCode', 'code status')
        .lean(),
      this.requestModel.countDocuments(filter),
    ]);

    return {
      success: true,
      message: 'Requests retrieved',
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * The one-click confirmation: marks the request paid and mints the code in
   * the same step, so the teacher never has to remember to do the second half.
   */
  async confirmPayment(id: string, adminNote?: string): Promise<ApiResponse<unknown>> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('معرّف غير صحيح');

    // Atomic pending -> paid. Double-clicking the confirm button must not
    // issue two codes for one payment.
    const request = await this.requestModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: 'pending' },
      { $set: { status: 'paid', paidAt: new Date(), adminNote: adminNote ?? null } },
      { new: true },
    );

    if (!request) {
      const existing = await this.requestModel.findById(id).populate('issuedCode', 'code');
      if (!existing) throw new NotFoundException('الطلب غير موجود');
      throw new BadRequestException(
        existing.status === 'paid'
          ? `تم تأكيد هذا الطلب من قبل. الكود: ${(existing.issuedCode as any)?.code ?? '—'}`
          : 'لا يمكن تأكيد طلب ملغي أو منتهي.',
      );
    }

    const generated = await this.accessCodesService.generate({
      targetKind: request.targetKind,
      targetId: (request.targetKind === 'lecture' ? request.lecture! : request.bundle!).toString(),
      count: 1,
      batchId: `REQ-${request.requestNumber}`,
      note: `طلب ${request.requestNumber}`,
    });

    const code = (generated.data as { codes: string[] }).codes[0];
    const codeDoc = await this.accessCodesService.findByCode(code);
    if (codeDoc) {
      request.issuedCode = codeDoc._id;
      await request.save();
    }

    const amount = (request.priceMinorUnits / 100).toFixed(0);

    return {
      success: true,
      message: 'تم تأكيد الدفع وإصدار الكود',
      data: {
        requestNumber: request.requestNumber,
        code,
        // Ready to paste back into the same WhatsApp conversation.
        whatsappMessage:
          `تم تأكيد دفع ${amount} ج.م لطلب ${request.requestNumber}.\n` +
          `${request.titleSnapshot}\n\nكود التفعيل: ${code}\n\n` +
          `فعّله من صفحة "تفعيل كود" على المنصة.`,
      },
    };
  }

  async cancel(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('معرّف غير صحيح');

    const request = await this.requestModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: 'pending' },
      { $set: { status: 'cancelled' } },
      { new: true },
    );
    if (!request) throw new BadRequestException('لا يمكن إلغاء هذا الطلب');

    return { success: true, message: 'تم إلغاء الطلب', data: request };
  }

  // Run hourly by the scheduler. Without it the pending queue fills with
  // students who tapped buy and never sent a message, and the teacher loses
  // the ability to trust it as a to-do list.
  async expireStale(): Promise<number> {
    const { data: settings } = await this.settingsService.getSettings();
    const cutoff = new Date(Date.now() - settings.purchaseRequestExpiryHours * 60 * 60 * 1000);

    const result = await this.requestModel.updateMany(
      { status: 'pending', createdAt: { $lt: cutoff } },
      { $set: { status: 'expired' } },
    );

    return result.modifiedCount;
  }
}
