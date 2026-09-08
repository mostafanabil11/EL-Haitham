import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, HydratedDocument } from 'mongoose';

export type ProgressDocument = HydratedDocument<Progress>;

@Schema({ timestamps: true })
export class Progress {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'LectureItem', required: true })
  item!: Types.ObjectId;

  // Denormalized so "how far through this lecture is the student" is one query
  // rather than a join — it is what the dashboard and the parent report both
  // need, and both are read far more often than progress is written.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lecture', required: true })
  lecture!: Types.ObjectId;

  // Where to resume. The single most appreciated feature in any video course:
  // a student watching on a phone between classes never starts over.
  @Prop({ default: 0, min: 0 })
  lastPositionSeconds: number = 0;

  // Highest point reached, not total time watched. Rewinding to re-hear an
  // explanation must not inflate progress, and scrubbing forward must not
  // either — see LearnService.recordProgress.
  @Prop({ default: 0, min: 0 })
  furthestSeconds: number = 0;

  @Prop({ type: Date, default: null })
  completedAt: Date | null = null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProgressSchema = SchemaFactory.createForClass(Progress);

// One row per student per item; upserted on every write.
ProgressSchema.index({ user: 1, item: 1 }, { unique: true });
ProgressSchema.index({ user: 1, lecture: 1 });
