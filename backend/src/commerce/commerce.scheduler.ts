import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnrollmentsService } from './enrollments.service';
import { PurchaseRequestsService } from './purchase-requests.service';

@Injectable()
export class CommerceScheduler {
  private readonly logger = new Logger(CommerceScheduler.name);

  constructor(
    private enrollmentsService: EnrollmentsService,
    private purchaseRequestsService: PurchaseRequestsService,
  ) {}

  // Access expiry is enforced at read time by hasAccess(), which checks
  // expiresAt directly — so this sweep is not what protects content. It exists
  // to keep `isActive` truthful, because the admin screens and the student's
  // dashboard read that flag rather than recomputing dates per row.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async deactivateExpiredEnrollments() {
    const count = await this.enrollmentsService.deactivateExpired();
    if (count > 0) this.logger.log(`Deactivated ${count} expired enrollment(s)`);
  }

  // Without this the pending queue fills with students who tapped buy and
  // never sent a message, and the teacher stops trusting it as a to-do list —
  // which is the entire value of having a queue.
  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleRequests() {
    const count = await this.purchaseRequestsService.expireStale();
    if (count > 0) this.logger.log(`Expired ${count} stale purchase request(s)`);
  }
}
