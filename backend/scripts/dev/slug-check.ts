import { slugify, uniqueSlug } from '../../src/common/utils/slugify.util';

const titles = [
  'اسم الفاعل والدرس الاول',
  'المحاضرة ٣',
  'ليالي الامتحان',
  'النحو - الجملة الاسمية',
  'المحاضرة الأولى',
  'البلاغة: التشبيه والاستعارة',
  '٢٠٢٦ مراجعة نهائية',
];
for (const t of titles) console.log(JSON.stringify(t).padEnd(44), '->', JSON.stringify(slugify(t)));

console.log('\ncollisions (four lectures all titled "المحاضرة الأولى"):');
const taken: string[] = [];
for (let i = 0; i < 4; i++) {
  const s = uniqueSlug('المحاضرة الأولى', taken);
  taken.push(s);
  console.log('  ', s);
}
console.log('\nunsluggable title falls back:', JSON.stringify(uniqueSlug('!!!', taken)));
