import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, HydratedDocument } from 'mongoose';
import { GRADES, Grade } from '@/common/constants/grades';

export type BundleDocument = HydratedDocument<Bundle>;

// Several lectures sold as one purchase — a full month, or a revision pack
// like "ليالي الامتحان". The incumbent's best-selling single item had 143
// subscribers against a median in the low tens, which looks exactly like a
// bundle-shaped product being sold through a lecture-shaped field.
//
// A bundle is only a *sales* grouping. Redeeming one writes one Enrollment per
// lecture inside it, so nothing downstream needs to know bundles exist.
@Schema({ timestamps: true })
export class Bundle {
  @Prop({ required: true, trim: true })
  titleAr: string = '';

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string = '';

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Lecture', default: [] })
  lectures: Types.ObjectId[] = [];

  @Prop({ required: true, min: 0 })
  priceMinorUnits: number = 0;

  @Prop({ required: true, enum: GRADES })
  grade!: Grade;

  @Prop({ required: true, match: /^\d{4}\/\d{4}$/ })
  academicYear: string = '';

  @Prop({ type: String, default: null })
  description: string | null = null;

  @Prop({ type: String, default: null })
  coverImage: string | null = null;

  @Prop({ default: false })
  isPublished: boolean = false;

  @Prop({ default: false })
  isArchived: boolean = false;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BundleSchema = SchemaFactory.createForClass(Bundle);

BundleSchema.index({ grade: 1, academicYear: 1, isPublished: 1, isArchived: 1 });
