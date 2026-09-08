import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, HydratedDocument } from 'mongoose';
import { GRADES, Grade } from '@/common/constants/grades';

export type LectureDocument = HydratedDocument<Lecture>;

// THE BUYABLE UNIT.
//
// Modelled on how the teacher actually sells rather than on how an LMS
// normally models content: of his 117 items, most hold exactly one lesson and
// are named "المحاضرة ٢" or "محاضرة ١٢", priced 40–100 EGP each. A student buys
// one lecture at a time. Bundles exist on top of this (Phase 3) for the cases
// where several are sold together, and a bundle purchase writes one Enrollment
// per lecture rather than inventing a second kind of entitlement.
@Schema({ timestamps: true })
export class Lecture {
  @Prop({ required: true, trim: true })
  titleAr: string = '';

  // Transliterated Latin, unique across the whole collection. See
  // slugify.util.ts for why not percent-encoded Arabic.
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string = '';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Term', required: true })
  term!: Types.ObjectId;

  // Denormalized from the term. Every catalogue query filters on these two,
  // and copying them avoids a lookup on the hottest read path in the app.
  // Kept in step by LecturesService, which refuses to write a lecture whose
  // grade/year disagree with its term.
  @Prop({ required: true, enum: GRADES })
  grade!: Grade;

  @Prop({ required: true, match: /^\d{4}\/\d{4}$/ })
  academicYear: string = '';

  // Minor units — piastres. 6500 = 65.00 EGP. Integers only, so no rounding
  // drift once these are summed into a bundle price.
  @Prop({ required: true, min: 0 })
  priceMinorUnits: number = 0;

  @Prop({ type: String, default: null })
  description: string | null = null;

  @Prop({ type: String, default: null })
  coverImage: string | null = null;

  @Prop({ default: false })
  isPublished: boolean = false;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null = null;

  @Prop({ default: 0 })
  order: number = 0;

  @Prop({ default: false })
  isArchived: boolean = false;

  // Null means access lasts until the end of the academic year, resolved
  // against the term. A number overrides that for this lecture only.
  @Prop({ type: Number, default: null, min: 1 })
  accessDurationDays: number | null = null;

  // Denormalized counts, recomputed whenever an item is written. The
  // catalogue renders these on every card; aggregating them per request would
  // be a lookup per lecture on the busiest page of the site.
  @Prop({ default: 0, min: 0 })
  itemCount: number = 0;

  @Prop({ default: 0, min: 0 })
  totalDurationSeconds: number = 0;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LectureSchema = SchemaFactory.createForClass(Lecture);

// The public catalogue query.
LectureSchema.index({ grade: 1, academicYear: 1, isPublished: 1, isArchived: 1, order: 1 });
// Listing a term's lectures in the admin panel and on the course page.
LectureSchema.index({ term: 1, order: 1 });
