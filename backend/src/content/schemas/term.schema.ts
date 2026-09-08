import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { GRADES, Grade } from '@/common/constants/grades';

export type TermDocument = HydratedDocument<Term>;

// The grouping the incumbent has no concept of. It keeps a flat list of 117
// lectures distinguished only by an `isActive` boolean, of which 107 are dead
// last-year content sitting in the same list as the 10 live ones. A term binds
// a set of lectures to a grade AND an academic year, so rolling the year
// forward archives everything from the previous one in a single move.
@Schema({ timestamps: true })
export class Term {
  @Prop({ required: true, trim: true })
  titleAr: string = '';

  @Prop({ required: true, enum: GRADES })
  grade!: Grade;

  // "2026/2027". Matched against Settings.currentAcademicYear to decide what
  // counts as current without touching any lecture document.
  @Prop({ required: true, match: /^\d{4}\/\d{4}$/ })
  academicYear: string = '';

  @Prop({ default: 0 })
  order: number = 0;

  // Set when the academic year rolls over. Archived terms (and everything
  // under them) disappear from the student-facing catalogue but stay readable
  // for anyone who already bought a lecture inside them.
  @Prop({ default: false })
  isArchived: boolean = false;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TermSchema = SchemaFactory.createForClass(Term);

// The catalogue query is always "this grade, this year, not archived, in order".
TermSchema.index({ grade: 1, academicYear: 1, order: 1 });
TermSchema.index({ isArchived: 1, grade: 1 });
