import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@/auth/schemas/user.schema';
import { Enrollment, EnrollmentDocument } from '@/commerce/schemas/enrollment.schema';
import { Lecture, LectureDocument } from '@/content/schemas/lecture.schema';
import { Progress, ProgressDocument } from '@/learn/schemas/progress.schema';
import { SettingsService } from '@/settings/settings.service';
import { toLocalEgyptianPhone, whatsappLink } from '@/common/utils/phone.util';
import { GRADE_LABELS_AR } from '@/common/constants/grades';
import { PaginatedApiResponse, ApiResponse } from '@/common/types/api-response';

/** One lecture's line in a report. */
export interface ReportLine {
  lectureId: string;
  titleAr: string;
  percentWatched: number;
  isComplete: boolean;
  hasStarted: boolean;
  activeThisPeriod: boolean;
}

export interface StudentReport {
  studentId: string;
  name: string;
  grade: string | null;
  phoneLocal: string;
  parentPhoneLocal: string;
  periodLabel: string;
  lectures: ReportLine[];
  lectureCount: number;
  completedCount: number;
  startedCount: number;
  averagePercent: number;
  lastActiveAt: string | null;
  /** Ready to paste, or to open in WhatsApp against the parent's number. */
  message: string;
  whatsappUrl: string | null;
}

const AR_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/**
 * The monthly note home.
 *
 * Parents are the people who actually pay, and the incumbent gives them
 * nothing — a parent's only signal is whether their child says the lectures
 * are going well. A short, specific message with real numbers in it is the
 * cheapest renewal mechanism this platform has, and it costs the teacher one
 * tap per student.
 *
 * Two honesty constraints shaped the numbers below:
 *
 * 1. `furthestSeconds` is cumulative, not a time series — nothing records how
 *    much was watched *within* a month. So the percentage is stated as overall
 *    progress, and the month only decides which lectures count as "active".
 *    Reporting a cumulative figure as monthly would inflate every second
 *    month's report and eventually get noticed.
 * 2. A lecture with no duration recorded cannot yield a percentage. It is
 *    reported as started / not started rather than given a fabricated 0%.
 */
@Injectable()
export class AdminReportsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Lecture.name) private lectureModel: Model<LectureDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    private settingsService: SettingsService,
  ) {}

  /** "2026-09" -> the window it names, plus an Arabic label. */
  private resolvePeriod(month?: string): { start: Date; end: Date; label: string } {
    const now = new Date();
    let year = now.getFullYear();
    let monthIndex = now.getMonth();

    if (month) {
      const match = /^(\d{4})-(\d{2})$/.exec(month);
      if (!match) throw new BadRequestException('الشهر يجب أن يكون بالشكل 2026-09');
      year = Number(match[1]);
      monthIndex = Number(match[2]) - 1;
      if (monthIndex < 0 || monthIndex > 11) {
        throw new BadRequestException('الشهر غير صحيح');
      }
    }

    return {
      start: new Date(year, monthIndex, 1),
      // Day 0 of the next month is the last day of this one.
      end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
      label: `${AR_MONTHS[monthIndex]} ${year}`,
    };
  }

  private buildMessage(report: Omit<StudentReport, 'message' | 'whatsappUrl'>, siteName: string) {
    const lines: string[] = [
      `تقرير متابعة — ${report.name}`,
      `عن شهر ${report.periodLabel}`,
      '',
      `المحاضرات المشترك بها: ${report.lectureCount}`,
    ];

    for (const lecture of report.lectures) {
      if (!lecture.hasStarted) {
        lines.push(`• ${lecture.titleAr}: لم يبدأ بعد`);
      } else if (lecture.isComplete) {
        lines.push(`• ${lecture.titleAr}: مكتملة ✅`);
      } else {
        lines.push(`• ${lecture.titleAr}: ${lecture.percentWatched}%`);
      }
    }

    lines.push('');
    lines.push(
      report.completedCount > 0
        ? `أكمل ${report.completedCount} من ${report.lectureCount} محاضرة.`
        : `بدأ ${report.startedCount} من ${report.lectureCount} محاضرة.`,
    );

    if (report.lastActiveAt) {
      const days = Math.floor(
        (Date.now() - new Date(report.lastActiveAt).getTime()) / (24 * 60 * 60 * 1000),
      );
      lines.push(
        days <= 0 ? 'آخر مشاهدة: اليوم' : days === 1 ? 'آخر مشاهدة: أمس' : `آخر مشاهدة: منذ ${days} يوم`,
      );
    } else {
      lines.push('لم يشاهد أي درس بعد.');
    }

    lines.push('');
    lines.push(siteName);

    return lines.join('\n');
  }

  private async compose(
    users: UserDocument[],
    period: { start: Date; end: Date; label: string },
    siteName: string,
  ): Promise<StudentReport[]> {
    const userIds = users.map((u) => u._id);
    if (userIds.length === 0) return [];

    // Everything for the whole page in three queries rather than three per
    // student — a 30-row report screen would otherwise be 90 round trips.
    const [enrollments, progress] = await Promise.all([
      this.enrollmentModel
        .find({ user: { $in: userIds }, isActive: true, grantedAt: { $lte: period.end } })
        .lean(),
      this.progressModel.find({ user: { $in: userIds } }).lean(),
    ]);

    const lectureIds = [...new Set(enrollments.map((e) => String(e.lecture)))];
    const lectures = await this.lectureModel
      .find({ _id: { $in: lectureIds.map((id) => new Types.ObjectId(id)) } })
      .select('titleAr totalDurationSeconds')
      .lean();
    const lectureById = new Map(lectures.map((l) => [String(l._id), l]));

    // progress rows keyed by "user:lecture", summed across that lecture's items.
    const watched = new Map<string, { seconds: number; completedItems: number; last: Date | null }>();
    for (const row of progress) {
      const key = `${String(row.user)}:${String(row.lecture)}`;
      const entry = watched.get(key) ?? { seconds: 0, completedItems: 0, last: null };
      entry.seconds += row.furthestSeconds ?? 0;
      if (row.completedAt) entry.completedItems += 1;
      const updated = (row as { updatedAt?: Date }).updatedAt ?? null;
      if (updated && (!entry.last || updated > entry.last)) entry.last = updated;
      watched.set(key, entry);
    }

    const enrollmentsByUser = new Map<string, typeof enrollments>();
    for (const enrollment of enrollments) {
      const key = String(enrollment.user);
      const list = enrollmentsByUser.get(key) ?? [];
      list.push(enrollment);
      enrollmentsByUser.set(key, list);
    }

    return users.map((user) => {
      const userId = String(user._id);
      const lines: ReportLine[] = [];
      let lastActive: Date | null = null;

      for (const enrollment of enrollmentsByUser.get(userId) ?? []) {
        const lecture = lectureById.get(String(enrollment.lecture));
        if (!lecture) continue;

        const entry = watched.get(`${userId}:${String(enrollment.lecture)}`);
        const seconds = entry?.seconds ?? 0;
        const duration = lecture.totalDurationSeconds ?? 0;

        // Capped at 100: furthestSeconds is clamped per report, but a lecture
        // whose recorded duration is later shortened would otherwise produce
        // "137%" in a message sent to a parent.
        const percent = duration > 0 ? Math.min(100, Math.round((seconds / duration) * 100)) : 0;

        if (entry?.last && (!lastActive || entry.last > lastActive)) lastActive = entry.last;

        lines.push({
          lectureId: String(lecture._id),
          titleAr: lecture.titleAr,
          percentWatched: percent,
          isComplete: percent >= 90,
          hasStarted: seconds > 0,
          activeThisPeriod: !!entry?.last && entry.last >= period.start && entry.last <= period.end,
        });
      }

      const started = lines.filter((l) => l.hasStarted);
      const completed = lines.filter((l) => l.isComplete);
      const measurable = lines.filter((l) => l.percentWatched > 0 || l.hasStarted);

      const base = {
        studentId: userId,
        name: user.name,
        grade: user.grade ? (GRADE_LABELS_AR[user.grade] ?? user.grade) : null,
        phoneLocal: toLocalEgyptianPhone(user.phone),
        parentPhoneLocal: toLocalEgyptianPhone(user.parentPhone),
        periodLabel: period.label,
        lectures: lines,
        lectureCount: lines.length,
        completedCount: completed.length,
        startedCount: started.length,
        averagePercent:
          measurable.length > 0
            ? Math.round(measurable.reduce((sum, l) => sum + l.percentWatched, 0) / measurable.length)
            : 0,
        lastActiveAt: lastActive ? lastActive.toISOString() : null,
      };

      const message = this.buildMessage(base, siteName);

      return {
        ...base,
        message,
        // Addressed to the parent, not the student. That is the entire point:
        // the person paying hears how it is going without having to ask.
        whatsappUrl: user.parentPhone ? whatsappLink(user.parentPhone, message) : null,
      };
    });
  }

  async monthly(query: {
    month?: string;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedApiResponse<StudentReport[]>> {
    const period = this.resolvePeriod(query.month);
    const { data: settings } = await this.settingsService.getPublicSettings();
    const siteName = settings?.siteName ?? 'منصة اللغة العربية';

    const filter: Record<string, unknown> = { role: 'student' };
    if (query.q) {
      const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ phone: regex }, { parentPhone: regex }, { name: regex }];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    const reports = await this.compose(users, period, siteName);

    return {
      success: true,
      message: 'Reports generated',
      data: reports,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async forStudent(id: string, month?: string): Promise<ApiResponse<StudentReport>> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('معرّف غير صحيح');

    const user = await this.userModel.findById(new Types.ObjectId(id));
    if (!user) throw new NotFoundException('الطالب غير موجود');

    const period = this.resolvePeriod(month);
    const { data: settings } = await this.settingsService.getPublicSettings();
    const [report] = await this.compose(
      [user],
      period,
      settings?.siteName ?? 'منصة اللغة العربية',
    );

    return { success: true, message: 'Report generated', data: report };
  }
}
