import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, HydratedDocument } from 'mongoose';

export const REQUEST_STATUSES = ['pending', 'paid', 'cancelled', 'expired'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type PurchaseRequestDocument = HydratedDocument<PurchaseRequest>;

// The row that makes a WhatsApp sale into a record.
//
// Without this the teacher reconciles payments by scrolling his own chat
// history, which is how the incumbent's users work and why he cannot answer
// "who paid me this month" without counting manually. A request is created the
// moment a student presses the buy button, carries a short number into the
// prefilled WhatsApp message, and is closed out with one click when he
// confirms the money arrived — which is also what mints the access code.
@Schema({ timestamps: true })
export class PurchaseRequest {
  // Short and human-readable, because it gets read aloud and typed into chat.
  // e.g. "R-2609-0042"
  @Prop({ required: true, unique: true })
  requestNumber: string = '';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ required: true, enum: ['lecture', 'bundle'] })
  targetKind: 'lecture' | 'bundle' = 'lecture';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lecture', default: null })
  lecture: Types.ObjectId | null = null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Bundle', default: null })
  bundle: Types.ObjectId | null = null;

  // Captured at request time. A later price change must not silently alter
  // what a student was quoted before they paid.
  @Prop({ required: true, min: 0 })
  priceMinorUnits: number = 0;

  // Denormalized so the admin queue reads without a join, and so the record
  // survives a student later changing their number.
  @Prop({ required: true })
  phone: string = '';

  @Prop({ required: true })
  titleSnapshot: string = '';

  @Prop({ required: true, enum: REQUEST_STATUSES, default: 'pending' })
  status: RequestStatus = 'pending';

  @Prop({ type: Date, default: null })
  paidAt: Date | null = null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AccessCode', default: null })
  issuedCode: Types.ObjectId | null = null;

  @Prop({ type: String, default: null })
  adminNote: string | null = null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PurchaseRequestSchema = SchemaFactory.createForClass(PurchaseRequest);

// The admin queue: pending first, newest first.
PurchaseRequestSchema.index({ status: 1, createdAt: -1 });
PurchaseRequestSchema.index({ user: 1, createdAt: -1 });
// The expiry sweep for abandoned requests.
PurchaseRequestSchema.index({ status: 1, createdAt: 1 });
