import { Inject, Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lecture, LectureDocument } from '@/content/schemas/lecture.schema';
import { LectureItem, LectureItemDocument } from '@/content/schemas/lecture-item.schema';
import { User, UserDocument } from '@/auth/schemas/user.schema';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { EnrollmentsService } from '@/commerce/enrollments.service';
import { VIDEO_PROVIDER } from '@/video/video.module';
import type { VideoProvider } from '@/video/video-provider.interface';
import { ConfigService } from '@/config/config.service';
import { ApiResponse } from '@/common/types/api-response';
import { RecordProgressDto } from './dto';

// A lesson counts as finished at 90%, not 100%. Outros, closing remarks and
// the last few seconds of silence mean almost nobody reaches the true end, so
// a 100% rule quietly reports that no student ever completes anything.
const COMPLETION_RATIO = 0.9;

@Injectable()
export class LearnService {
  constructor(
    @InjectModel(Lecture.name) private lectureModel: Model<LectureDocument>,
    @InjectModel(LectureItem.name) private itemModel: Model<LectureItemDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    private enrollmentsService: EnrollmentsService,
    private configService: ConfigService,
    @Inject(VIDEO_PROVIDER) private videoProvider: VideoProvider,
  ) {}

  /**
   * The gate. Every route that serves paid content passes through here, so
   * there is exactly one implementation of "may this person see this" and no
   * opportunity for two call sites to drift apart.
   *
   * Free-preview items are the one bypass, and it is deliberate: the public
   * lecture page needs to play them to someone with no account at all, which
   * is what the incumbent's login wall prevents and what actually converts.
   */
  private async assertCanView(
    item: LectureItemDocument,
    userId: Types.ObjectId | null,
  ): Promise<void> {
    if (item.isFreePreview) return;

    if (!userId) {
      throw new ForbiddenException('يجب تسجيل الدخول لمشاهدة هذا الدرس.');
    }

    const hasAccess = await this.enrollmentsService.hasAccess(userId, item.lecture);
    if (!hasAccess) {
      throw new ForbiddenException('لم تشترك في هذه المحاضرة بعد.');
    }
  }

  /**
   * The full lecture, including the content the public outline withholds.
   */
  async getLectureForStudent(
    slug: string,
    userId: Types.ObjectId | null,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const lecture = await this.lectureModel
      .findOne({ slug: slug.toLowerCase(), isArchived: false })
      .lean();
    if (!lecture) throw new NotFoundException('المحاضرة غير موجودة');

    const hasAccess = userId ? await this.enrollmentsService.hasAccess(userId, lecture._id) : false;

    const items = await this.itemModel.find({ lecture: lecture._id }).sort({ order: 1 }).lean();

    const progressRows = userId
      ? await this.progressModel.find({ user: userId, lecture: lecture._id }).lean()
      : [];
    const progressByItem = new Map(progressRows.map((p) => [p.item.toString(), p]));

    const shaped = items.map((item) => {
      const unlocked = hasAccess || item.isFreePreview;
      const progress = progressByItem.get(item._id.toString());

      return {
        id: item._id,
        titleAr: item.titleAr,
        type: item.type,
        videoDurationSeconds: item.videoDurationSeconds,
        isFreePreview: item.isFreePreview,
        order: item.order,
        unlocked,
        // Withheld unless unlocked. The playback URL is never here under any
        // circumstance — it is minted per request by getPlaybackTicket, so it
        // cannot be scraped from a page payload.
        contentHtml: unlocked ? item.contentHtml : null,
        attachments: unlocked ? item.attachments : [],
        progress: progress
          ? {
              lastPositionSeconds: progress.lastPositionSeconds,
              furthestSeconds: progress.furthestSeconds,
              completedAt: progress.completedAt,
            }
          : null,
      };
    });

    return {
      success: true,
      message: 'Lecture retrieved',
      data: { ...lecture, hasAccess, items: shaped },
    };
  }

  /**
   * Mints a short-lived playback ticket for one item.
   *
   * Called at the moment of play, never at page render, so the URL's short
   * life starts when watching starts. Nothing about the provider leaks into
   * the response beyond what the player needs.
   */
  async getPlaybackTicket(itemId: string, userId: Types.ObjectId | null) {
    if (!Types.ObjectId.isValid(itemId)) throw new BadRequestException('معرّف غير صحيح');

    const item = await this.itemModel.findById(itemId);
    if (!item) throw new NotFoundException('الدرس غير موجود');

    await this.assertCanView(item, userId);

    if (item.type !== 'video') {
      throw new BadRequestException('هذا الدرس ليس فيديو.');
    }

    // An anonymous viewer of a free preview still gets a watermark, just a
    // generic one — there is no identity to attribute a leak to.
    const viewer = userId
      ? await this.userModel.findById(userId, 'name phone').lean()
      : null;

    const ticket = await this.videoProvider.getPlaybackTicket(
      item.videoAssetId ?? '',
      {
        userId: userId?.toString() ?? 'anonymous',
        name: viewer?.name ?? 'معاينة مجانية',
        phone: viewer?.phone ?? '',
      },
      this.configService.videoTokenTtlMinutes,
    );

    return {
      success: true,
      message: ticket.url ? 'Playback ready' : 'لم يتم رفع الفيديو بعد.',
      data: {
        ...ticket,
        itemId: item._id,
        durationSeconds: item.videoDurationSeconds,
        provider: this.videoProvider.name,
      },
    };
  }

  /**
   * Records where a student has reached.
   *
   * `furthestSeconds` only ever moves forward, and only by a plausible amount:
   * a client that reports jumping 40 minutes ahead in one 15-second interval
   * is scrubbing (or lying), and counting that would let anyone mark a lecture
   * complete by dragging the scrub bar. Position is stored as sent, because
   * resuming should honour wherever they actually stopped.
   */
  async recordProgress(userId: Types.ObjectId, dto: RecordProgressDto) {
    if (!Types.ObjectId.isValid(dto.itemId)) throw new BadRequestException('معرّف غير صحيح');

    const item = await this.itemModel.findById(dto.itemId);
    if (!item) throw new NotFoundException('الدرس غير موجود');

    await this.assertCanView(item, userId);

    const existing = await this.progressModel.findOne({ user: userId, item: item._id });
    const previousFurthest = existing?.furthestSeconds ?? 0;

    // Allow a little more than the reporting interval to absorb clock drift
    // and buffering, but nowhere near enough to skip a lesson.
    const maxPlausibleAdvance = 90;
    const furthest = Math.min(
      Math.max(previousFurthest, Math.min(dto.positionSeconds, previousFurthest + maxPlausibleAdvance)),
      item.videoDurationSeconds || dto.positionSeconds,
    );

    const isComplete =
      item.videoDurationSeconds > 0 && furthest >= item.videoDurationSeconds * COMPLETION_RATIO;

    await this.progressModel.updateOne(
      { user: userId, item: item._id },
      {
        $set: {
          lastPositionSeconds: dto.positionSeconds,
          furthestSeconds: furthest,
          lecture: item.lecture,
          ...(isComplete && !existing?.completedAt ? { completedAt: new Date() } : {}),
        },
        $setOnInsert: { user: userId, item: item._id },
      },
      { upsert: true },
    );

    return {
      success: true,
      message: 'Progress saved',
      data: { furthestSeconds: furthest, completed: isComplete },
    };
  }
}
