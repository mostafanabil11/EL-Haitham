import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Enrollment, EnrollmentDocument, EnrollmentSource } from './schemas/enrollment.schema';
import { Lecture, LectureDocument } from '@/content/schemas/lecture.schema';
import { Term, TermDocument } from '@/content/schemas/term.schema';
import { ApiResponse } from '@/common/types/api-response';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Lecture.name) private lectureModel: Model<LectureDocument>,
    @InjectModel(Term.name) private termModel: Model<TermDocument>,
  ) {}

  // Resolves when access should end for a given lecture.
  //
  // The lecture may set its own duration; otherwise access runs to the end of
  // the academic year its term belongs to. "End of year" is taken as 31 August
  // of the closing year in "2026/2027", which is when an Egyptian academic
  // year actually finishes — not 31 December.
  private async resolveExpiry(lecture: LectureDocument): Promise<Date | null> {
    if (lecture.accessDurationDays) {
      return new Date(Date.now() + lecture.accessDurationDays * 24 * 60 * 60 * 1000);
    }

    const closingYear = Number(lecture.academicYear.split('/')[1]);
    if (!Number.isFinite(closingYear)) return null;

    return new Date(Date.UTC(closingYear, 7, 31, 23, 59, 59));
  }

  /**
   * Grants access to a set of lectures, idempotently.
   *
   * Idempotent by design rather than by accident: the unique index on
   * {user, lecture} means a re-run after a partial failure cannot create a
   * duplicate, which is what lets redeemCode() claim a code first and grant
   * afterwards without a transaction. A lecture the student already holds is
   * reported as skipped rather than failing the whole grant — a bundle
   * overlapping one lecture they already bought should still deliver the
   * other five.
   */
  async grant(
    userId: Types.ObjectId,
    lectureIds: Types.ObjectId[],
    options: { source: EnrollmentSource; accessCode?: Types.ObjectId; bundle?: Types.ObjectId },
  ): Promise<{ granted: Types.ObjectId[]; alreadyHeld: Types.ObjectId[] }> {
    const lectures = await this.lectureModel.find({ _id: { $in: lectureIds } });
    if (lectures.length !== lectureIds.length) {
      throw new NotFoundException('بعض المحاضرات غير موجودة');
    }

    const granted: Types.ObjectId[] = [];
    const alreadyHeld: Types.ObjectId[] = [];

    for (const lecture of lectures) {
      const expiresAt = await this.resolveExpiry(lecture);

      // upsert + $setOnInsert: an existing enrollment is left exactly as it
      // is, so re-redeeming cannot quietly shorten an expiry the teacher
      // extended by hand.
      const result = await this.enrollmentModel.updateOne(
        { user: userId, lecture: lecture._id },
        {
          $setOnInsert: {
            user: userId,
            lecture: lecture._id,
            source: options.source,
            accessCode: options.accessCode ?? null,
            bundle: options.bundle ?? null,
            grantedAt: new Date(),
            expiresAt,
            isActive: true,
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) granted.push(lecture._id);
      else alreadyHeld.push(lecture._id);
    }

    return { granted, alreadyHeld };
  }

  // The single question every content route asks. Kept in one place so an
  // access check can never drift between call sites.
  async hasAccess(userId: Types.ObjectId, lectureId: Types.ObjectId): Promise<boolean> {
    const now = new Date();
    const enrollment = await this.enrollmentModel.findOne({
      user: userId,
      lecture: lectureId,
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });

    return !!enrollment;
  }

  async listForUser(userId: Types.ObjectId): Promise<ApiResponse<Record<string, unknown>[]>> {
    const now = new Date();
    const enrollments = await this.enrollmentModel
      .find({ user: userId, isActive: true })
      .sort({ grantedAt: -1 })
      .populate('lecture', 'titleAr slug grade priceMinorUnits itemCount totalDurationSeconds coverImage')
      .lean();

    const data = enrollments
      // A row whose lecture was hard-deleted would otherwise render as an
      // empty card the student cannot click.
      .filter((e) => e.lecture)
      .map((e) => ({
        id: e._id,
        lecture: e.lecture,
        grantedAt: e.grantedAt,
        expiresAt: e.expiresAt,
        isExpired: !!e.expiresAt && e.expiresAt <= now,
        source: e.source,
      }));

    return { success: true, message: 'Enrollments retrieved', data };
  }

  // --- Admin ---

  async grantManual(userId: string, lectureId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(lectureId)) {
      throw new BadRequestException('معرّف غير صحيح');
    }

    const result = await this.grant(new Types.ObjectId(userId), [new Types.ObjectId(lectureId)], {
      source: 'manual',
    });

    return {
      success: true,
      message: result.granted.length ? 'تم منح الوصول' : 'الطالب لديه هذه المحاضرة بالفعل',
      data: result,
    };
  }

  async setActive(enrollmentId: string, isActive: boolean) {
    if (!Types.ObjectId.isValid(enrollmentId)) throw new BadRequestException('معرّف غير صحيح');

    const enrollment = await this.enrollmentModel.findByIdAndUpdate(
      enrollmentId,
      { $set: { isActive } },
      { new: true },
    );
    if (!enrollment) throw new NotFoundException('الاشتراك غير موجود');

    return {
      success: true,
      message: isActive ? 'تم تفعيل الاشتراك' : 'تم إيقاف الاشتراك',
      data: enrollment,
    };
  }

  async extend(enrollmentId: string, days: number) {
    if (!Types.ObjectId.isValid(enrollmentId)) throw new BadRequestException('معرّف غير صحيح');

    const enrollment = await this.enrollmentModel.findById(enrollmentId);
    if (!enrollment) throw new NotFoundException('الاشتراك غير موجود');

    // Extending from "now" rather than from the old expiry when the old one
    // has already passed — otherwise adding 30 days to a subscription that
    // lapsed two months ago grants nothing.
    const from =
      enrollment.expiresAt && enrollment.expiresAt > new Date() ? enrollment.expiresAt : new Date();

    enrollment.expiresAt = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
    enrollment.isActive = true;
    await enrollment.save();

    return { success: true, message: 'تم تمديد الاشتراك', data: enrollment };
  }

  async listForLecture(lectureId: string) {
    if (!Types.ObjectId.isValid(lectureId)) throw new BadRequestException('معرّف غير صحيح');

    const enrollments = await this.enrollmentModel
      .find({ lecture: new Types.ObjectId(lectureId) })
      .sort({ grantedAt: -1 })
      .populate('user', 'name phone parentPhone grade')
      .lean();

    return { success: true, message: 'Enrollments retrieved', data: enrollments };
  }

  // Run daily by the scheduler.
  async deactivateExpired(): Promise<number> {
    const result = await this.enrollmentModel.updateMany(
      { isActive: true, expiresAt: { $ne: null, $lte: new Date() } },
      { $set: { isActive: false } },
    );
    return result.modifiedCount;
  }
}
