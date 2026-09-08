import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GRADES, Grade } from '@/common/constants/grades';

export type SessionDocument = HydratedDocument<Session>;

// One entry per signed-in device/browser, so logging in on a phone doesn't
// silently invalidate a desktop session — each holds its own hashed refresh
// token that rotates independently on every /auth/refresh call.
@Schema({ _id: true, timestamps: false })
export class Session {
  _id!: Types.ObjectId;

  @Prop({ required: true })
  tokenHash: string = '';

  @Prop({ type: String, default: null })
  userAgent: string | null = null;

  @Prop({ type: String, default: null })
  ip: string | null = null;

  @Prop({ required: true })
  createdAt: Date = new Date();

  @Prop({ required: true })
  expiresAt: Date = new Date();
}

export const SessionSchema = SchemaFactory.createForClass(Session);

export const USER_ROLES = ['student', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  // The login identifier and the primary support key. Stored normalized to
  // 201XXXXXXXXX by normalizeEgyptianPhone() — see phone.util.ts for why a
  // single canonical form matters here.
  @Prop({ required: true, unique: true, trim: true })
  phone: string = '';

  // Parents pay for the lectures and want to know whether their child is
  // watching them. Required at registration for that reason, and it is what
  // the Phase 6 progress reports are sent to.
  @Prop({ required: true, trim: true })
  parentPhone: string = '';

  // Arabic names are written and given as one string; splitting them into
  // first/last is an assumption that does not survive contact with real names.
  @Prop({ required: true, trim: true })
  name: string = '';

  @Prop({ required: true })
  password: string = '';

  // Required for students, meaningless for the teacher's own account — hence
  // the conditional rather than a blanket `required: true` that would force
  // the admin to claim a school year.
  @Prop({
    type: String,
    enum: GRADES,
    default: null,
    required: function (this: User) {
      return this.role === 'student';
    },
  })
  grade: Grade | null = null;

  // Optional. Students register without one; the teacher's own admin account
  // has one, which is what makes the emailed password-reset path work for the
  // account that actually needs it.
  @Prop({ type: String, default: null, lowercase: true, trim: true })
  email: string | null = null;

  // Reserved for WhatsApp OTP. Nothing verifies a phone today — there is no
  // WhatsApp API wired up yet, and login is deliberately NOT gated on this,
  // because gating on a check that cannot run would lock every student out.
  // The teacher confirms each purchase over WhatsApp by hand, and that
  // conversation is the real proof a number belongs to a person.
  @Prop({ default: false })
  isPhoneVerified: boolean = false;

  @Prop({ type: String, default: null })
  otpHash: string | null = null;

  @Prop({ type: Date, default: null })
  otpExpiresAt: Date | null = null;

  @Prop({ default: 0 })
  loginAttempts: number = 0;

  @Prop({ type: Date, default: null })
  lastLoginAttempt: Date | null = null;

  @Prop({ type: Date, default: null })
  lockedUntil: Date | null = null;

  @Prop({ default: true })
  isActive: boolean = true;

  @Prop({ required: true, enum: USER_ROLES, default: 'student' })
  role: UserRole = 'student';

  @Prop({ type: [SessionSchema], default: [] })
  sessions: Session[] = [];

  @Prop({ type: String, default: null })
  resetPasswordToken: string | null = null;

  @Prop({ type: Date, default: null })
  resetPasswordExpiresAt: Date | null = null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// resetPasswordToken stores a sha256 hash (not bcrypt — it's already 32 random
// bytes, so it needs no further slow-hashing) so resetPassword() can look the
// user up directly by token instead of bcrypt-comparing against every pending user.
//
// A partial index, not `sparse: true`: Mongoose's `default: null` above means
// every document has this field *present* (set to null), never actually
// absent — and MongoDB's sparse indexes only exempt documents where the
// field is missing entirely, not ones where it's explicitly null.
UserSchema.index(
  { resetPasswordToken: 1 },
  { partialFilterExpression: { resetPasswordToken: { $type: 'string' } } },
);

// Email is optional, so most rows carry an explicit null here. Same reasoning
// as above: `sparse` would not exempt those nulls and every student would
// collide with every other student. A partial index keyed on "is actually a
// string" is the correct way to make a nullable field's real values unique.
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);

// The teacher searches students by phone far more than by anything else, and
// the parent's number is how he finds a student when a parent calls him.
UserSchema.index({ parentPhone: 1 });
UserSchema.index({ grade: 1, createdAt: -1 });
