/**
 * Reconciles the indexes in MongoDB with the ones declared in the schemas.
 *
 * This exists because of a trap that costs real debugging time: Mongoose's
 * `autoIndex` only ever *creates* indexes that are missing. It will not drop
 * an index you removed from a schema, and it will not alter one whose options
 * changed. Change `@Prop({ unique: true })` on a field to a partial index and
 * the old non-partial unique index simply stays, silently winning, and the
 * failure surfaces much later as an inexplicable duplicate-key error on a
 * field that looks correctly defined in the code.
 *
 * That is exactly what happened here: `email` was once `required + unique`,
 * so a plain unique `email_1` index survived into this database. Making email optional meant most users store `null`, and the second
 * such user collided — even though the schema declares a partial index that
 * would have allowed it.
 *
 * `syncIndexes()` is the one API that reconciles both directions: it drops
 * indexes not in the schema and builds the ones that are.
 *
 * DESTRUCTIVE: it drops indexes this codebase does not declare. Run it on
 * deploy, after a schema change — not casually against a database whose
 * indexes were tuned by hand outside these schemas.
 *
 *   npm run sync:indexes
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { UserSchema, User } from '../src/auth/schemas/user.schema';
import { SettingsSchema, Settings } from '../src/settings/schemas/settings.schema';
import { AuditLogSchema, AuditLog } from '../src/admin/schemas/audit-log.schema';
import { TermSchema, Term } from '../src/content/schemas/term.schema';
import { LectureSchema, Lecture } from '../src/content/schemas/lecture.schema';
import { LectureItemSchema, LectureItem } from '../src/content/schemas/lecture-item.schema';
import { AccessCodeSchema, AccessCode } from '../src/commerce/schemas/access-code.schema';
import { EnrollmentSchema, Enrollment } from '../src/commerce/schemas/enrollment.schema';
import { PurchaseRequestSchema, PurchaseRequest } from '../src/commerce/schemas/purchase-request.schema';
import { BundleSchema, Bundle } from '../src/commerce/schemas/bundle.schema';
import { CounterSchema, Counter } from '../src/commerce/schemas/counter.schema';
import { ProgressSchema, Progress } from '../src/learn/schemas/progress.schema';

const MODELS: Array<[string, mongoose.Schema]> = [
  [User.name, UserSchema as unknown as mongoose.Schema],
  [Settings.name, SettingsSchema as unknown as mongoose.Schema],
  [AuditLog.name, AuditLogSchema as unknown as mongoose.Schema],
  [Term.name, TermSchema as unknown as mongoose.Schema],
  [Lecture.name, LectureSchema as unknown as mongoose.Schema],
  [LectureItem.name, LectureItemSchema as unknown as mongoose.Schema],
  [AccessCode.name, AccessCodeSchema as unknown as mongoose.Schema],
  [Enrollment.name, EnrollmentSchema as unknown as mongoose.Schema],
  [PurchaseRequest.name, PurchaseRequestSchema as unknown as mongoose.Schema],
  [Bundle.name, BundleSchema as unknown as mongoose.Schema],
  [Counter.name, CounterSchema as unknown as mongoose.Schema],
  [Progress.name, ProgressSchema as unknown as mongoose.Schema],
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);

  for (const [name, schema] of MODELS) {
    const model = mongoose.model(name, schema);
    const dropped = await model.syncIndexes();
    const current = await model.collection.indexes();

    console.log(`\n${name}`);
    console.log(`  dropped: ${dropped.length ? dropped.join(', ') : '(none)'}`);
    for (const index of current) {
      const flags = [
        index.unique ? 'unique' : null,
        index.partialFilterExpression ? 'partial' : null,
      ]
        .filter(Boolean)
        .join(', ');
      console.log(`  ✓ ${index.name}${flags ? `  [${flags}]` : ''}`);
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ Indexes synced');
}

main().catch((error) => {
  console.error('❌ Index sync failed:', error.message);
  process.exit(1);
});
