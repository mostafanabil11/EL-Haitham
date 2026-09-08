import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SettingsDocument = HydratedDocument<Settings>;

// Fields safe to serve to a logged-out visitor. SettingsService.getPublic()
// projects exactly this list and nothing else.
//
// The incumbent platform serves its entire settings document from a public
// endpoint — including its vendor subscription tier, renewal date, per-student
// billing rate and every feature flag. That is the specific mistake this
// split exists to avoid: adding a field here is a deliberate act, whereas
// adding one to a whole-document response is an accident waiting to happen.
export const PUBLIC_SETTINGS_FIELDS = [
  'siteName',
  'tagline',
  'teacherName',
  'teacherBio',
  'teacherPhoto',
  'logo',
  'heroImage',
  'whatsappNumber',
  'socialLinks',
  'isRegistrationOpen',
] as const;

@Schema({ _id: false })
export class SocialLinks {
  @Prop({ type: String, default: null })
  facebook: string | null = null;

  @Prop({ type: String, default: null })
  youtube: string | null = null;

  @Prop({ type: String, default: null })
  tiktok: string | null = null;

  @Prop({ type: String, default: null })
  instagram: string | null = null;
}

export const SocialLinksSchema = SchemaFactory.createForClass(SocialLinks);

// Singleton — exactly one document ever exists in this collection (see
// SettingsService.getSettings, which upserts against an empty filter).
@Schema({ timestamps: true })
export class Settings {
  // --- Public ---

  @Prop({ default: 'منصة اللغة العربية' })
  siteName: string = 'منصة اللغة العربية';

  @Prop({ type: String, default: null })
  tagline: string | null = null;

  @Prop({ type: String, default: null })
  teacherName: string | null = null;

  @Prop({ type: String, default: null })
  teacherBio: string | null = null;

  @Prop({ type: String, default: null })
  teacherPhoto: string | null = null;

  @Prop({ type: String, default: null })
  logo: string | null = null;

  @Prop({ type: String, default: null })
  heroImage: string | null = null;

  // The number students are handed off to when they press buy. Stored in
  // international format without the leading + (e.g. 201044175784) because
  // that is the form wa.me links require.
  @Prop({ type: String, default: null })
  whatsappNumber: string | null = null;

  @Prop({ type: SocialLinksSchema, default: () => ({}) })
  socialLinks: SocialLinks = new SocialLinks();

  // Lets the teacher close signups between academic years without taking the
  // site down.
  @Prop({ default: true })
  isRegistrationOpen: boolean = true;

  // --- Admin only ---

  @Prop({ default: 'EGP' })
  currency: string = 'EGP';

  // Applied to a lecture that does not set its own. Null = access lasts until
  // the end of the academic year, resolved against the lecture's term.
  @Prop({ type: Number, default: null, min: 1 })
  defaultAccessDurationDays: number | null = null;

  // The year new content is filed under, e.g. "2026/2027". Rolling this
  // forward is what archives last year's lectures in one move — the incumbent
  // has no such concept, which is why 107 of its 117 items sit dead in the
  // same list as the live ones.
  @Prop({ default: '2026/2027' })
  currentAcademicYear: string = '2026/2027';

  // Hours a pending purchase request survives before the scheduler expires it.
  @Prop({ default: 48, min: 1 })
  purchaseRequestExpiryHours: number = 48;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
