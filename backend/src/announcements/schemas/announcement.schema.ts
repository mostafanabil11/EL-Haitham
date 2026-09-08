import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { GRADES, Grade } from '@/common/constants/grades';

export type AnnouncementDocument = HydratedDocument<Announcement>;

export const AUDIENCES = ['all', 'grade', 'lecture'] as const;
export type Audience = (typeof AUDIENCES)[number];

@Schema({ timestamps: true })
export class Announcement {
  @Prop({ required: true, trim: true })
  titleAr!: string;

  @Prop({ required: true, trim: true })
  bodyAr!: string;

  /**
   * Who sees it. Three audiences rather than one broadcast, because a message
   * about the third-secondary exam schedule reaching a prep-3 student is how a
   * platform teaches its users to ignore announcements.
   */
  @Prop({ required: true, enum: AUDIENCES, default: 'all' })
  audience: Audience = 'all';

  @Prop({ type: String, enum: GRADES, default: null })
  grade: Grade | null = null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lecture', default: null })
  lecture: MongooseSchema.Types.ObjectId | null = null;

  // Drafts exist so the teacher can write one at night and release it in the
  // morning without a scheduler.
  @Prop({ default: false })
  isPublished: boolean = false;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null = null;

  /**
   * Optional self-destruct. "الحصة مؤجلة ليوم الخميس" is useful for three days
   * and misleading forever after, and nothing else in the system will remember
   * to take it down.
   */
  @Prop({ type: Date, default: null })
  expiresAt: Date | null = null;

  // Pins one notice above the rest — the exam timetable, typically.
  @Prop({ default: false })
  isPinned: boolean = false;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);

// The student feed asks "published, for me, not expired", newest first.
AnnouncementSchema.index({ isPublished: 1, audience: 1, grade: 1, publishedAt: -1 });
AnnouncementSchema.index({ isPublished: 1, lecture: 1, publishedAt: -1 });
