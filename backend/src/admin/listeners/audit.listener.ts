import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

interface AdminMutationPayload {
  adminId: string | null;
  adminPhone: string | null;
  action: string;
  params: unknown;
  body: unknown;
  resultSummary: unknown;
}

@Injectable()
export class AuditListener {
  private readonly logger = new Logger(AuditListener.name);

  constructor(@InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>) {}

  @OnEvent('admin.mutation')
  async handleAdminMutation(payload: AdminMutationPayload) {
    try {
      await this.auditLogModel.create({
        admin: payload.adminId && Types.ObjectId.isValid(payload.adminId) ? payload.adminId : null,
        adminPhone: payload.adminPhone,
        action: payload.action,
        params: payload.params,
        body: payload.body,
        resultSummary: payload.resultSummary,
      });
    } catch (err) {
      // The mutation this describes already succeeded — a failure to log it
      // is a problem for observability, not a reason to look like the
      // request failed.
      this.logger.error(`Failed to write audit log for ${payload.action}`, err as Error);
    }
  }
}
