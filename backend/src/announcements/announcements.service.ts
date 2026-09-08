import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Announcement, AnnouncementDocument } from './schemas/announcement.schema';
import { Enrollment, EnrollmentDocument } from '@/commerce/schemas/enrollment.schema';
import { User, UserDocument } from '@/auth/schemas/user.schema';
import { ApiResponse } from '@/common/types/api-response';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectModel(Announcement.name) private model: Model<AnnouncementDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('معرّف غير صحيح');
    return new Types.ObjectId(id);
  }

  // --- Student feed ---

  /**
   * What one student should see, and nothing else.
   *
   * The lecture-scoped clause is the reason this needs the enrollment
   * collection: an announcement about a lecture is only meaningful to someone
   * who bought it, and showing it to everyone else would leak which lectures
   * exist behind the paywall as well as being noise.
   */
  async forStudent(userId: Types.ObjectId): Promise<ApiResponse<unknown>> {
    const user = await this.userModel.findById(userId).select('grade');
    if (!user) throw new NotFoundException('الحساب غير موجود');

    const enrollments = await this.enrollmentModel
      .find({ user: userId, isActive: true })
      .select('lecture')
      .lean();
    const lectureIds = enrollments.map((e) => e.lecture);

    const now = new Date();
    const audienceClauses: Record<string, unknown>[] = [{ audience: 'all' }];
    if (user.grade) audienceClauses.push({ audience: 'grade', grade: user.grade });
    if (lectureIds.length > 0) {
      audienceClauses.push({ audience: 'lecture', lecture: { $in: lectureIds } });
    }

    const items = await this.model
      .find({
        isPublished: true,
        // An announcement with no expiry never expires; one with an expiry in
        // the past is gone without anyone having to remember to delete it.
        $and: [
          { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
          { $or: audienceClauses },
        ],
      })
      // Pinned first, then newest. A pinned exam timetable should not sink
      // under three routine notices.
      .sort({ isPinned: -1, publishedAt: -1 })
      .limit(20)
      .populate('lecture', 'titleAr slug')
      .lean();

    return { success: true, message: 'Announcements retrieved', data: items };
  }

  // --- Admin ---

  async list(includeUnpublished = true) {
    const filter = includeUnpublished ? {} : { isPublished: true };
    const items = await this.model
      .find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .populate('lecture', 'titleAr slug')
      .lean();

    return { success: true, message: 'Announcements retrieved', data: items };
  }

  async create(dto: CreateAnnouncementDto): Promise<ApiResponse<unknown>> {
    const created = await this.model.create({
      titleAr: dto.titleAr,
      bodyAr: dto.bodyAr,
      audience: dto.audience,
      grade: dto.audience === 'grade' ? dto.grade : null,
      lecture: dto.audience === 'lecture' && dto.lectureId ? this.objectId(dto.lectureId) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isPinned: dto.isPinned ?? false,
    });

    return { success: true, message: 'تم إنشاء الإعلان', data: created };
  }

  async update(id: string, dto: UpdateAnnouncementDto): Promise<ApiResponse<unknown>> {
    const doc = await this.model.findById(this.objectId(id));
    if (!doc) throw new NotFoundException('الإعلان غير موجود');

    if (dto.titleAr !== undefined) doc.titleAr = dto.titleAr;
    if (dto.bodyAr !== undefined) doc.bodyAr = dto.bodyAr;
    if (dto.isPinned !== undefined) doc.isPinned = dto.isPinned;
    if (dto.expiresAt !== undefined) doc.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    // Changing audience clears the target that no longer applies, so a notice
    // switched from one grade to everyone cannot keep a stale grade filter.
    if (dto.audience !== undefined) {
      doc.audience = dto.audience;
      if (dto.audience !== 'grade') doc.grade = null;
      if (dto.audience !== 'lecture') doc.lecture = null;
    }
    if (dto.grade !== undefined && doc.audience === 'grade') doc.grade = dto.grade ?? null;
    if (dto.lectureId !== undefined && doc.audience === 'lecture') {
      doc.lecture = dto.lectureId ? (this.objectId(dto.lectureId) as never) : null;
    }

    if (doc.audience === 'grade' && !doc.grade) {
      throw new BadRequestException('اختر الصف الدراسي');
    }
    if (doc.audience === 'lecture' && !doc.lecture) {
      throw new BadRequestException('اختر المحاضرة');
    }

    await doc.save();
    return { success: true, message: 'تم تحديث الإعلان', data: doc };
  }

  async setPublished(id: string, isPublished: boolean): Promise<ApiResponse<unknown>> {
    const doc = await this.model.findById(this.objectId(id));
    if (!doc) throw new NotFoundException('الإعلان غير موجود');

    doc.isPublished = isPublished;
    // publishedAt is the sort key for the student feed, and it is set on first
    // publish only — re-publishing an old notice should not jump it to the top
    // of everyone's list as if it were new.
    if (isPublished && !doc.publishedAt) doc.publishedAt = new Date();
    await doc.save();

    return {
      success: true,
      message: isPublished ? 'تم نشر الإعلان' : 'تم إخفاء الإعلان',
      data: doc,
    };
  }

  async remove(id: string): Promise<ApiResponse<unknown>> {
    const doc = await this.model.findByIdAndDelete(this.objectId(id));
    if (!doc) throw new NotFoundException('الإعلان غير موجود');
    return { success: true, message: 'تم حذف الإعلان', data: { id } };
  }
}
