import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, HydratedDocument } from 'mongoose';

export const ITEM_TYPES = ['video', 'pdf', 'text', 'live'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

@Schema({ _id: false })
export class Attachment {
  @Prop({ required: true, trim: true })
  name: string = '';

  // Object-storage key, not a public URL. Resolved to a signed or CDN URL at
  // read time, so rotating buckets or locking a file down later does not
  // require rewriting every document that references it.
  @Prop({ required: true })
  key: string = '';

  @Prop({ default: 0, min: 0 })
  sizeBytes: number = 0;

  @Prop({ type: String, default: null })
  mimeType: string | null = null;
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

export type LectureItemDocument = HydratedDocument<LectureItem>;

// One piece of content inside a lecture: usually the video, sometimes a PDF
// alongside it. Only 8 of the incumbent's 117 lectures carry a file at all, so
// this is deliberately simple rather than a general-purpose content block.
@Schema({ timestamps: true })
export class LectureItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lecture', required: true })
  lecture!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  titleAr: string = '';

  @Prop({ required: true, enum: ITEM_TYPES })
  type: ItemType = 'video';

  // Provider-agnostic handle. Which provider it belongs to is decided by
  // VIDEO_PROVIDER, and the raw playback URL is never stored — it is minted
  // per request, short-lived and signed, by the VideoProvider implementation.
  @Prop({ type: String, default: null })
  videoAssetId: string | null = null;

  @Prop({ default: 0, min: 0 })
  videoDurationSeconds: number = 0;

  @Prop({ type: String, default: null })
  contentHtml: string | null = null;

  @Prop({ type: [AttachmentSchema], default: [] })
  attachments: Attachment[] = [];

  // The free sample. This is what lets the public lecture page show real
  // content to someone who has not paid — the single biggest thing the
  // incumbent's login wall prevents.
  @Prop({ default: false })
  isFreePreview: boolean = false;

  @Prop({ default: 0 })
  order: number = 0;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LectureItemSchema = SchemaFactory.createForClass(LectureItem);

LectureItemSchema.index({ lecture: 1, order: 1 });
