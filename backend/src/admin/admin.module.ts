import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminOverviewService } from './admin-overview.service';
import { AdminController } from './admin.controller';
import { AuditListener } from './listeners/audit.listener';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { User, UserSchema } from '@/auth/schemas/user.schema';
import { Enrollment, EnrollmentSchema } from '@/commerce/schemas/enrollment.schema';
import { AccessCode, AccessCodeSchema } from '@/commerce/schemas/access-code.schema';
import {
  PurchaseRequest,
  PurchaseRequestSchema,
} from '@/commerce/schemas/purchase-request.schema';
import { Lecture, LectureSchema } from '@/content/schemas/lecture.schema';
import { Progress, ProgressSchema } from '@/learn/schemas/progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      // Read-only here: the student list, the overview counters and the audit
      // listener need direct model access across domains that don't otherwise
      // depend on each other. No writes to any of these happen through this
      // module — those stay owned by the service that owns the collection.
      { name: User.name, schema: UserSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: AccessCode.name, schema: AccessCodeSchema },
      { name: PurchaseRequest.name, schema: PurchaseRequestSchema },
      { name: Lecture.name, schema: LectureSchema },
      { name: Progress.name, schema: ProgressSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminOverviewService, AuditListener],
})
export class AdminModule {}
