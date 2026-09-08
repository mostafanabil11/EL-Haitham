import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, HydratedDocument } from 'mongoose';

export const ENROLLMENT_SOURCES = ['code', 'manual', 'gift'] as const;
export type EnrollmentSource = (typeof ENROLLMENT_SOURCES)[number];

export type EnrollmentDocument = HydratedDocument<Enrollment>;

// The entitlement. One row per (student, lecture) — a bundle redemption
// writes several of these rather than introducing a second kind of access
// record, so every gate in the system asks exactly one question:
// "is there an active enrollment for this student and this lecture?"
@Schema({ timestamps: true })
export class Enrollment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lecture', required: true })
  lecture!: Types.ObjectId;

  @Prop({ required: true, enum: ENROLLMENT_SOURCES, default: 'code' })
  source: EnrollmentSource = 'code';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AccessCode', default: null })
  accessCode: Types.ObjectId | null = null;

  // Recorded when the grant came from a bundle, so the teacher can see why a
  // student has six lectures from one payment.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Bundle', default: null })
  bundle: Types.ObjectId | null = null;

  @Prop({ required: true, default: () => new Date() })
  grantedAt: Date = new Date();

  // Null = no expiry. Otherwise the scheduler deactivates it once passed.
  @Prop({ type: Date, default: null })
  expiresAt: Date | null = null;

  // Separate from expiry so the teacher can revoke access immediately (a
  // refund, a shared account) without pretending it expired.
  @Prop({ default: true })
  isActive: boolean = true;

  createdAt?: Date;
  updatedAt?: Date;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// One enrollment per student per lecture. This is the constraint that makes
// redemption safely retryable: if the code is claimed but the grant fails
// halfway, re-running it cannot produce a duplicate — and two concurrent
// redemptions of a bundle containing the same lecture collapse to one row.
EnrollmentSchema.index({ user: 1, lecture: 1 }, { unique: true });

// "What can this student watch" — the dashboard's only query.
EnrollmentSchema.index({ user: 1, isActive: 1 });
// The expiry sweep.
EnrollmentSchema.index({ isActive: 1, expiresAt: 1 });
