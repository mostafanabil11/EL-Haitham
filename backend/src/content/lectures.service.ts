import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lecture, LectureDocument } from './schemas/lecture.schema';
import { LectureItem, LectureItemDocument } from './schemas/lecture-item.schema';
import { Term, TermDocument } from './schemas/term.schema';
import { uniqueSlug } from '@/common/utils/slugify.util';
import { ApiResponse } from '@/common/types/api-response';
import { escapeRegex } from '@/common/utils/regex.util';
import {
  CreateLectureDto,
  UpdateLectureDto,
  CreateLectureItemDto,
  UpdateLectureItemDto,
  ReorderDto,
  CatalogQueryDto,
} from './dto';

@Injectable()
export class LecturesService {
  constructor(
    @InjectModel(Lecture.name) private lectureModel: Model<LectureDocument>,
    @InjectModel(LectureItem.name) private itemModel: Model<LectureItemDocument>,
    @InjectModel(Term.name) private termModel: Model<TermDocument>,
  ) {}

  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('معرّف غير صحيح');
    return new Types.ObjectId(id);
  }

  private async buildSlug(titleAr: string, excludeId?: Types.ObjectId): Promise<string> {
    const filter = excludeId ? { _id: { $ne: excludeId } } : {};
    const taken = await this.lectureModel.find(filter, 'slug').lean();
    return uniqueSlug(
      titleAr,
      taken.map((l) => l.slug),
    );
  }

  // itemCount and totalDurationSeconds are denormalized onto the lecture
  // because the catalogue renders both on every card. Recomputed from the
  // items rather than incremented, so a failed write cannot leave the counter
  // permanently out of step with reality.
  private async recount(lectureId: Types.ObjectId) {
    const [agg] = await this.itemModel.aggregate([
      { $match: { lecture: lectureId } },
      {
        $group: {
          _id: null,
          itemCount: { $sum: 1 },
          totalDurationSeconds: { $sum: '$videoDurationSeconds' },
        },
      },
    ]);

    await this.lectureModel.updateOne(
      { _id: lectureId },
      {
        $set: {
          itemCount: agg?.itemCount ?? 0,
          totalDurationSeconds: agg?.totalDurationSeconds ?? 0,
        },
      },
    );
  }

  // --- Admin: lectures ---

  async create(dto: CreateLectureDto) {
    const term = await this.termModel.findById(this.objectId(dto.termId));
    if (!term) throw new NotFoundException('الترم غير موجود');

    const lecture = await this.lectureModel.create({
      titleAr: dto.titleAr,
      slug: await this.buildSlug(dto.titleAr),
      term: term._id,
      // Copied from the term, never taken from the request — a lecture whose
      // grade disagreed with its term's would vanish from the catalogue.
      grade: term.grade,
      academicYear: term.academicYear,
      priceMinorUnits: dto.priceMinorUnits,
      description: dto.description ?? null,
      coverImage: dto.coverImage ?? null,
      accessDurationDays: dto.accessDurationDays ?? null,
      order: dto.order ?? (await this.lectureModel.countDocuments({ term: term._id })),
    });

    return { success: true, message: 'تم إنشاء المحاضرة', data: lecture };
  }

  async update(id: string, dto: UpdateLectureDto) {
    const lecture = await this.lectureModel.findById(this.objectId(id));
    if (!lecture) throw new NotFoundException('المحاضرة غير موجودة');

    if (dto.termId) {
      const term = await this.termModel.findById(this.objectId(dto.termId));
      if (!term) throw new NotFoundException('الترم غير موجود');
      lecture.term = term._id;
      lecture.grade = term.grade;
      lecture.academicYear = term.academicYear;
    }

    // The slug follows the title, but only while the lecture is unpublished.
    // Once it is public its URL may already be circulating in WhatsApp groups,
    // and silently changing it turns every shared link into a 404.
    if (dto.titleAr && dto.titleAr !== lecture.titleAr) {
      lecture.titleAr = dto.titleAr;
      if (!lecture.isPublished) {
        lecture.slug = await this.buildSlug(dto.titleAr, lecture._id);
      }
    }

    for (const key of ['priceMinorUnits', 'description', 'coverImage', 'accessDurationDays', 'order', 'isArchived'] as const) {
      if (dto[key] !== undefined) (lecture as any)[key] = dto[key];
    }

    await lecture.save();
    return { success: true, message: 'تم تحديث المحاضرة', data: lecture };
  }

  async setPublished(id: string, isPublished: boolean) {
    const lecture = await this.lectureModel.findById(this.objectId(id));
    if (!lecture) throw new NotFoundException('المحاضرة غير موجودة');

    // Publishing an empty lecture puts a buy button on a page with nothing
    // behind it. The teacher finds out when a student pays and complains.
    if (isPublished && lecture.itemCount === 0) {
      throw new BadRequestException('لا يمكن نشر محاضرة فارغة. أضف درساً واحداً على الأقل.');
    }

    lecture.isPublished = isPublished;
    lecture.publishedAt = isPublished ? (lecture.publishedAt ?? new Date()) : null;
    await lecture.save();

    return {
      success: true,
      message: isPublished ? 'تم نشر المحاضرة' : 'تم إخفاء المحاضرة',
      data: lecture,
    };
  }

  async reorder(dto: ReorderDto) {
    await this.lectureModel.bulkWrite(
      dto.ids.map((id, index) => ({
        updateOne: { filter: { _id: this.objectId(id) }, update: { $set: { order: index } } },
      })),
    );
    return { success: true, message: 'تم إعادة الترتيب', data: null };
  }

  async remove(id: string) {
    const _id = this.objectId(id);
    const lecture = await this.lectureModel.findById(_id);
    if (!lecture) throw new NotFoundException('المحاضرة غير موجودة');

    // Phase 3 adds the enrollment check here: a lecture anyone has ever bought
    // must be archived rather than deleted, or their purchase points at
    // nothing. Until enrollments exist, published is the best proxy.
    if (lecture.isPublished) {
      throw new BadRequestException('أخفِ المحاضرة أولاً قبل حذفها.');
    }

    await this.itemModel.deleteMany({ lecture: _id });
    await this.lectureModel.deleteOne({ _id });

    return { success: true, message: 'تم حذف المحاضرة', data: null };
  }

  async findOneAdmin(id: string): Promise<ApiResponse<Record<string, unknown>>> {
    const lecture = await this.lectureModel.findById(this.objectId(id)).populate('term').lean();
    if (!lecture) throw new NotFoundException('المحاضرة غير موجودة');

    const items = await this.itemModel.find({ lecture: lecture._id }).sort({ order: 1 }).lean();
    return { success: true, message: 'Lecture retrieved', data: { ...lecture, items } };
  }

  async findAllAdmin(query: CatalogQueryDto & { includeArchived?: boolean }) {
    const filter: Record<string, unknown> = {};
    if (query.grade) filter.grade = query.grade;
    if (query.academicYear) filter.academicYear = query.academicYear;
    if (!query.includeArchived) filter.isArchived = false;
    if (query.q) filter.titleAr = new RegExp(escapeRegex(query.q), 'i');

    const lectures = await this.lectureModel
      .find(filter)
      .sort({ grade: 1, order: 1 })
      .populate('term', 'titleAr')
      .lean();

    return { success: true, message: 'Lectures retrieved', data: lectures };
  }

  // --- Admin: items ---

  async addItem(lectureId: string, dto: CreateLectureItemDto) {
    const _id = this.objectId(lectureId);
    const lecture = await this.lectureModel.findById(_id);
    if (!lecture) throw new NotFoundException('المحاضرة غير موجودة');

    const item = await this.itemModel.create({
      ...dto,
      lecture: _id,
      order: dto.order ?? (await this.itemModel.countDocuments({ lecture: _id })),
    });

    await this.recount(_id);
    return { success: true, message: 'تمت إضافة الدرس', data: item };
  }

  async updateItem(itemId: string, dto: UpdateLectureItemDto) {
    const item = await this.itemModel.findById(this.objectId(itemId));
    if (!item) throw new NotFoundException('الدرس غير موجود');

    Object.assign(item, dto);

    // The cross-field rules from CreateLectureItemDto cannot run on a partial
    // payload, so they are re-checked against the merged document here.
    if (item.type === 'text' && !(item.contentHtml ?? '').trim()) {
      throw new BadRequestException('درس نصي يجب أن يحتوي على محتوى');
    }
    if (item.type === 'pdf' && item.attachments.length === 0) {
      throw new BadRequestException('درس ملف يجب أن يحتوي على مرفق واحد على الأقل');
    }

    await item.save();
    await this.recount(item.lecture);

    return { success: true, message: 'تم تحديث الدرس', data: item };
  }

  async removeItem(itemId: string) {
    const item = await this.itemModel.findById(this.objectId(itemId));
    if (!item) throw new NotFoundException('الدرس غير موجود');

    const lectureId = item.lecture;
    await this.itemModel.deleteOne({ _id: item._id });
    await this.recount(lectureId);

    // A lecture that just lost its last item would otherwise stay published
    // with nothing behind it — the same hole setPublished() refuses to open.
    const lecture = await this.lectureModel.findById(lectureId);
    if (lecture && lecture.isPublished && lecture.itemCount === 0) {
      lecture.isPublished = false;
      lecture.publishedAt = null;
      await lecture.save();
    }

    return { success: true, message: 'تم حذف الدرس', data: null };
  }

  async reorderItems(dto: ReorderDto) {
    await this.itemModel.bulkWrite(
      dto.ids.map((id, index) => ({
        updateOne: { filter: { _id: this.objectId(id) }, update: { $set: { order: index } } },
      })),
    );
    return { success: true, message: 'تم إعادة الترتيب', data: null };
  }

  // --- Public catalogue ---

  // Everything below is readable without an account. This is the deliberate
  // inversion of the incumbent, which hides its catalogue behind a login wall
  // while serving the same data unauthenticated from its own API — getting
  // neither the privacy nor the conversions.

  async catalog(query: CatalogQueryDto) {
    const filter: Record<string, unknown> = { isPublished: true, isArchived: false };
    if (query.grade) filter.grade = query.grade;
    if (query.academicYear) filter.academicYear = query.academicYear;
    if (query.q) filter.titleAr = new RegExp(escapeRegex(query.q), 'i');

    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    const [items, total] = await Promise.all([
      this.lectureModel
        .find(filter, 'titleAr slug grade academicYear priceMinorUnits description coverImage itemCount totalDurationSeconds order publishedAt')
        .sort({ grade: 1, order: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.lectureModel.countDocuments(filter),
    ]);

    return {
      success: true,
      message: 'Catalog retrieved',
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(slug: string): Promise<ApiResponse<Record<string, unknown>>> {
    const lecture = await this.lectureModel
      .findOne({ slug: slug.toLowerCase(), isPublished: true, isArchived: false })
      .populate('term', 'titleAr')
      .lean();

    if (!lecture) throw new NotFoundException('المحاضرة غير موجودة');

    // The curriculum is public; the content is not. Every item's title, type
    // and duration is returned so a visitor can see exactly what they would be
    // buying, but videoAssetId, contentHtml and attachments are withheld
    // unless the item is a free preview. Playback URLs are never in this
    // response at all — those are minted per request in Phase 4, after an
    // enrollment check.
    const items = await this.itemModel
      .find({ lecture: lecture._id })
      .sort({ order: 1 })
      .select('titleAr type videoDurationSeconds isFreePreview order contentHtml')
      .lean();

    const outline = items.map((item) => ({
      id: item._id,
      titleAr: item.titleAr,
      type: item.type,
      videoDurationSeconds: item.videoDurationSeconds,
      isFreePreview: item.isFreePreview,
      order: item.order,
      contentHtml: item.isFreePreview ? item.contentHtml : null,
    }));

    return {
      success: true,
      message: 'Lecture retrieved',
      data: { ...lecture, items: outline },
    };
  }
}
