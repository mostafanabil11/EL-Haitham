import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CounterDocument = HydratedDocument<Counter>;

// Generic atomic-sequence store. Order numbers are generated via a single
// findOneAndUpdate({key}, {$inc: {seq: 1}}, {upsert: true}) against this
// collection — Mongo guarantees that single-document update is atomic, so
// two orders placed in the same millisecond still get distinct numbers
// without any application-level locking.
@Schema({ timestamps: false })
export class Counter {
  @Prop({ required: true, unique: true })
  key: string = '';

  @Prop({ required: true, default: 0 })
  seq: number = 0;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
