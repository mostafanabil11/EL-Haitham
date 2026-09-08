import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@/auth/schemas/user.schema';
import { Enrollment, EnrollmentDocument } from '@/commerce/schemas/enrollment.schema';
import { AccessCode, AccessCodeDocument } from '@/commerce/schemas/access-code.schema';
import {
  PurchaseRequest,
  PurchaseRequestDocument,
} from '@/commerce/schemas/purchase-request.schema';
import { Lecture, LectureDocument } from '@/content/schemas/lecture.schema';
import { Progress, ProgressDocument } from '@/learn/schemas/progress.schema';

/**
 * The numbers on /admin — the first screen the teacher sees each morning.
 *
 * Every figure here is chosen to answer a question he would otherwise ask over
 * WhatsApp: is anyone waiting on me, did I get paid this month, is anyone
 * actually watching. Vanity metrics (page views, signups with no purchase) are
 * deliberately absent — they would push the numbers that matter down the page.
 */
@Injectable()
export class AdminOverviewService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(AccessCode.name) private codeModel: Model<AccessCodeDocument>,
    @InjectModel(PurchaseRequest.name) private requestModel: Model<PurchaseRequestDocument>,
    @InjectModel(Lecture.name) private lectureModel: Model<LectureDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
  ) {}

  async overview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      studentCount,
      newStudentsThisMonth,
      activeEnrollments,
      pendingRequests,
      unusedCodes,
      publishedLectures,
      revenue,
      mostWatched,
      recentRequests,
    ] = await Promise.all([
      this.userModel.countDocuments({ role: 'student' }),
      this.userModel.countDocuments({ role: 'student', createdAt: { $gte: monthStart } }),

      // "Active" has two conditions and both matter: a revoked enrollment is
      // inactive, and one whose academic year has closed is expired. Counting
      // only isActive would overstate access by a whole year's archive.
      this.enrollmentModel.countDocuments({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      }),

      this.requestModel.countDocuments({ status: 'pending' }),
      this.codeModel.countDocuments({ status: 'unused' }),
      this.lectureModel.countDocuments({ isPublished: true, isArchived: false }),

      // Revenue is summed from confirmed requests, not from list prices, and
      // uses the snapshotted price — so a later price change never rewrites
      // what a past month earned.
      this.requestModel.aggregate<{ _id: null; total: number; count: number }>([
        { $match: { status: 'paid', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$priceMinorUnits' }, count: { $sum: 1 } } },
      ]),

      // Distinct watchers per lecture, not total seconds: one student
      // re-watching a lecture ten times should not outrank ten students
      // watching it once.
      this.progressModel.aggregate<{ _id: Types.ObjectId; watchers: number; seconds: number }>([
        {
          $group: {
            _id: '$lecture',
            watchers: { $addToSet: '$user' },
            seconds: { $sum: '$furthestSeconds' },
          },
        },
        { $project: { watchers: { $size: '$watchers' }, seconds: 1 } },
        { $sort: { watchers: -1, seconds: -1 } },
        { $limit: 5 },
      ]),

      this.requestModel
        .find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(5)
        .populate('user', 'name phone')
        .lean(),
    ]);

    const watchedLectureIds = mostWatched.map((row) => row._id).filter(Boolean);
    const watchedLectures = await this.lectureModel
      .find({ _id: { $in: watchedLectureIds } })
      .select('titleAr slug grade')
      .lean();
    const byId = new Map(watchedLectures.map((l) => [String(l._id), l]));

    return {
      success: true,
      message: 'Overview retrieved',
      data: {
        students: { total: studentCount, newThisMonth: newStudentsThisMonth },
        activeEnrollments,
        pendingRequests,
        unusedCodes,
        publishedLectures,
        revenueThisMonth: {
          minorUnits: revenue[0]?.total ?? 0,
          confirmedRequests: revenue[0]?.count ?? 0,
        },
        mostWatched: mostWatched
          .map((row) => {
            const lecture = byId.get(String(row._id));
            if (!lecture) return null;
            return {
              id: String(lecture._id),
              titleAr: lecture.titleAr,
              slug: lecture.slug,
              grade: lecture.grade,
              watchers: row.watchers,
              seconds: row.seconds,
            };
          })
          .filter(Boolean),
        // The oldest pending requests, because the queue is a to-do list and
        // the student who has been waiting longest is the one to answer first.
        oldestPending: recentRequests,
      },
    };
  }
}
