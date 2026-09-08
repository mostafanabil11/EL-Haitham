import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessCodesService } from './access-codes.service';
import { EnrollmentsService } from './enrollments.service';
import { PurchaseRequestsService } from './purchase-requests.service';
import { CommerceController } from './commerce.controller';
import { CommerceAdminController } from './commerce.admin.controller';
import { CommerceScheduler } from './commerce.scheduler';
import { AccessCode, AccessCodeSchema } from './schemas/access-code.schema';
import { Enrollment, EnrollmentSchema } from './schemas/enrollment.schema';
import { PurchaseRequest, PurchaseRequestSchema } from './schemas/purchase-request.schema';
import { Bundle, BundleSchema } from './schemas/bundle.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { User, UserSchema } from '@/auth/schemas/user.schema';
import { ContentModule } from '@/content/content.module';
import { SettingsModule } from '@/settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccessCode.name, schema: AccessCodeSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: PurchaseRequest.name, schema: PurchaseRequestSchema },
      { name: Bundle.name, schema: BundleSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // Brings the Lecture and Term models along — ContentModule re-exports
    // MongooseModule for exactly this.
    ContentModule,
    SettingsModule,
  ],
  controllers: [CommerceController, CommerceAdminController],
  providers: [AccessCodesService, EnrollmentsService, PurchaseRequestsService, CommerceScheduler],
  // EnrollmentsService is exported because Phase 4's playback route is gated
  // on hasAccess() — that check must have exactly one implementation.
  exports: [EnrollmentsService, AccessCodesService],
})
export class CommerceModule {}
