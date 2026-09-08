/**
 * DEMO CONTENT ONLY — not real lectures.
 *
 * Seeds a handful of terms, lectures and items so the catalogue, the public
 * lecture page and the admin list have something to render during
 * development. Shaped after the real teacher's data: lectures are the buyable
 * unit, usually one video each, priced 40–100 EGP, spread across four grades.
 *
 *   npm run seed:demo            add the demo content
 *   npm run seed:demo -- --clear remove it again, leaving real content alone
 *
 * Everything it creates is tagged `isDemo: true`, so --clear removes exactly
 * what this script added and never touches lectures the teacher wrote.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { TermSchema, Term } from '../src/content/schemas/term.schema';
import { LectureSchema, Lecture } from '../src/content/schemas/lecture.schema';
import { LectureItemSchema, LectureItem } from '../src/content/schemas/lecture-item.schema';
import { slugify } from '../src/common/utils/slugify.util';

const YEAR = '2026/2027';

const PLAN: Array<{
  grade: 'prep3' | 'sec1' | 'sec2' | 'sec3';
  term: string;
  lectures: Array<{ title: string; price: number; minutes: number; free?: boolean }>;
}> = [
  {
    grade: 'sec3',
    term: 'الترم الأول',
    lectures: [
      { title: 'النحو — الجملة الاسمية', price: 7500, minutes: 62, free: true },
      { title: 'النحو — الجملة الفعلية', price: 7500, minutes: 55 },
      { title: 'البلاغة — التشبيه والاستعارة', price: 8000, minutes: 71 },
      { title: 'الأدب — مدرسة الديوان', price: 6500, minutes: 48 },
      { title: 'ليالي الامتحان — مراجعة نهائية', price: 10000, minutes: 120 },
    ],
  },
  {
    grade: 'sec2',
    term: 'الترم الأول',
    lectures: [
      { title: 'المحاضرة الأولى — المشتقات', price: 6500, minutes: 50, free: true },
      { title: 'المحاضرة الثانية — أسلوب الاستثناء', price: 6500, minutes: 47 },
      { title: 'المحاضرة الثالثة — الأدب في العصر العباسي', price: 7000, minutes: 58 },
    ],
  },
  {
    grade: 'sec1',
    term: 'الترم الأول',
    lectures: [
      { title: 'المحاضرة الأولى — أقسام الكلام', price: 6000, minutes: 45, free: true },
      { title: 'المحاضرة الثانية — علامات الإعراب', price: 6000, minutes: 52 },
    ],
  },
  {
    grade: 'prep3',
    term: 'الترم الأول',
    lectures: [{ title: 'اسم الفاعل — الدرس الأول', price: 4000, minutes: 38, free: true }],
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);

  const termModel = mongoose.model(Term.name, TermSchema);
  const lectureModel = mongoose.model(Lecture.name, LectureSchema);
  const itemModel = mongoose.model(LectureItem.name, LectureItemSchema);

  if (process.argv.includes('--clear')) {
    const lectures = await lectureModel.find({ isDemo: true }, '_id');
    const ids = lectures.map((l) => l._id);
    const items = await itemModel.deleteMany({ lecture: { $in: ids } });
    const lec = await lectureModel.deleteMany({ isDemo: true });
    const terms = await termModel.deleteMany({ isDemo: true });
    console.log(
      `🧹 Removed ${terms.deletedCount} terms, ${lec.deletedCount} lectures, ${items.deletedCount} items`,
    );
    await mongoose.disconnect();
    return;
  }

  let termOrder = 0;
  let created = { terms: 0, lectures: 0, items: 0 };

  for (const block of PLAN) {
    const term = await termModel.create({
      titleAr: block.term,
      grade: block.grade,
      academicYear: YEAR,
      order: termOrder++,
      isDemo: true,
    });
    created.terms++;

    let order = 0;
    for (const spec of block.lectures) {
      // Slug collisions are the normal case here — "المحاضرة الأولى" appears
      // once per grade — so the grade is folded in rather than relying on the
      // -2 / -3 suffix, which would produce meaningless URLs.
      const slug = `${slugify(spec.title)}-${block.grade}`;

      const lecture = await lectureModel.create({
        titleAr: spec.title,
        slug,
        term: term._id,
        grade: block.grade,
        academicYear: YEAR,
        priceMinorUnits: spec.price,
        description: `شرح مفصل لدرس ${spec.title} مع أمثلة وتدريبات.`,
        isPublished: true,
        publishedAt: new Date(),
        order: order++,
        isDemo: true,
      });
      created.lectures++;

      await itemModel.create({
        lecture: lecture._id,
        titleAr: spec.title,
        type: 'video',
        videoAssetId: null,
        videoDurationSeconds: spec.minutes * 60,
        isFreePreview: spec.free ?? false,
        order: 0,
      });
      created.items++;

      await lectureModel.updateOne(
        { _id: lecture._id },
        { $set: { itemCount: 1, totalDurationSeconds: spec.minutes * 60 } },
      );
    }
  }

  console.log(
    `✅ Seeded ${created.terms} terms, ${created.lectures} lectures, ${created.items} items (all tagged isDemo)`,
  );
  console.log('   Remove them again with:  npm run seed:demo -- --clear');

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Seed failed:', error.message);
  process.exit(1);
});
