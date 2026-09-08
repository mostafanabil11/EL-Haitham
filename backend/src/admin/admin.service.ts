import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@/auth/schemas/user.schema';
import { Enrollment, EnrollmentDocument } from '@/commerce/schemas/enrollment.schema';
import { AccessCode, AccessCodeDocument } from '@/commerce/schemas/access-code.schema';
import {
  PurchaseRequest,
  PurchaseRequestDocument,
} from '@/commerce/schemas/purchase-request.schema';
import { Progress, ProgressDocument } from '@/learn/schemas/progress.schema';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';
import { ApiResponse } from '@/common/types/api-response';

// Student reads for the admin area. The dashboard counters live next door in
// AdminOverviewService; this file owns the list and the per-student drill-down.

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(AccessCode.name) private codeModel: Model<AccessCodeDocument>,
    @InjectModel(PurchaseRequest.name) private requestModel: Model<PurchaseRequestDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
  ) {}

  async listStudents(query: AdminCustomerQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.q) {
      const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      // Phone first, deliberately. The teacher looks a student up by the
      // number they messaged him from far more often than by name, and the
      // parent's number is how he finds a student when a parent calls.
      filter.$or = [{ phone: regex }, { parentPhone: regex }, { name: regex }, { email: regex }];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('name phone parentPhone grade email role isActive createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    return {
      success: true,
      message: 'Students retrieved',
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }


  /**
   * Everything about one student on one screen.
   *
   * This is the shape of a support conversation: a parent messages saying the
   * lecture they paid for is not showing, and the teacher needs to see, in one
   * place, what they bought, which code they used, and whether they have
   * actually opened it. Four round trips through separate list screens is how
   * that conversation currently goes.
   */
  async getStudent(id: string): Promise<ApiResponse<Record<string, unknown>>> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('معرّف غير صحيح');
    const userId = new Types.ObjectId(id);

    const user = await this.userModel
      .findById(userId)
      .select('name phone parentPhone grade email role isActive createdAt');
    if (!user) throw new NotFoundException('الطالب غير موجود');

    const [enrollments, codes, requests, progress] = await Promise.all([
      this.enrollmentModel
        .find({ user: userId })
        .sort({ grantedAt: -1 })
        .populate('lecture', 'titleAr slug grade priceMinorUnits')
        .lean(),
      this.codeModel
        .find({ redeemedBy: userId })
        .sort({ redeemedAt: -1 })
        .populate('lecture', 'titleAr')
        .populate('bundle', 'titleAr')
        .lean(),
      this.requestModel.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
      this.progressModel
        .find({ user: userId })
        .sort({ updatedAt: -1 })
        .populate('lecture', 'titleAr slug')
        .lean(),
    ]);

    const now = new Date();

    return {
      success: true,
      message: 'Student retrieved',
      data: {
        student: user,
        enrollments: enrollments.map((e) => ({
          ...e,
          isExpired: !!e.expiresAt && e.expiresAt <= now,
        })),
        codes,
        requests,
        progress,
        // "Last active" is the most recent playback report, not the most
        // recent login — a student who signs in and watches nothing is not
        // active in any sense the teacher cares about.
        lastActiveAt:
          (progress[0] as { updatedAt?: Date } | undefined)?.updatedAt ?? null,
      },
    };
  }

  async listAuditLog(query: AdminAuditQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.auditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      success: true,
      message: 'Audit log retrieved',
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}
