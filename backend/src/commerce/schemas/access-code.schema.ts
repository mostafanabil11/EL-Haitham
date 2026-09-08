import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, HydratedDocument } from 'mongoose';

export const CODE_STATUSES = ['unused', 'redeemed', 'revoked'] as const;
export type CodeStatus = (typeof CODE_STATUSES)[number];

export const CODE_TARGETS = ['lecture', 'bundle'] as const;
export type CodeTarget = (typeof CODE_TARGETS)[number];

export type AccessCodeDocument = HydratedDocument<AccessCode>;

// The voucher. Deliberately NOT the same thing as access — see Enrollment.
//
// A code is what the teacher types into WhatsApp after a student pays. An
// enrollment is what actually unlocks a lecture. Keeping them separate is what
// makes the awkward cases tractable: granting a scholarship with no code,
// revoking access without destroying the sales record, extending an expiry,
// or handing out a replacement code because the first was mistyped.
@Schema({ timestamps: true })
export class AccessCode {
  // Stored in plaintext, on purpose. The teacher has to read it off his screen
  // and type it into a WhatsApp message; a hashed code could never be shown
  // again after generation, which would break the only delivery mechanism
  // this business has. Access is admin-only and every read of the list is
  // behind the same role guard as the rest of /admin.
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string = '';

  @Prop({ required: true, enum: CODE_TARGETS })
  targetKind: CodeTarget = 'lecture';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lecture', default: null })
  lecture: Types.ObjectId | null = null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Bundle', default: null })
  bundle: Types.ObjectId | null = null;

  @Prop({ required: true, enum: CODE_STATUSES, default: 'unused' })
  status: CodeStatus = 'unused';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  redeemedBy: Types.ObjectId | null = null;

  @Prop({ type: Date, default: null })
  redeemedAt: Date | null = null;

  // An unredeemed code can go stale — a batch printed for a term that has
  // ended should stop working rather than surfacing a year later.
  @Prop({ type: Date, default: null })
  expiresAt: Date | null = null;

  // Groups a print run so the teacher can hand out 50 codes at a centre and
  // still find them again, or revoke the whole batch if the sheet is lost.
  @Prop({ type: String, default: null, index: true })
  batchId: string | null = null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'PurchaseRequest', default: null })
  issuedFor: Types.ObjectId | null = null;

  @Prop({ type: String, default: null })
  note: string | null = null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AccessCodeSchema = SchemaFactory.createForClass(AccessCode);

// The redemption lookup, and the admin list filtered by status.
AccessCodeSchema.index({ status: 1, createdAt: -1 });
AccessCodeSchema.index({ redeemedBy: 1 });
