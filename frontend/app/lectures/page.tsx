import type { Metadata } from 'next';
import Link from 'next/link';
import { getCatalog } from '@/lib/server-api';
import { GRADES, GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { LectureCard } from '@/components/LectureCard';

export const metadata: Metadata = {
  title: 'المحاضرات',
  description: 'كل محاضرات اللغة العربية المتاحة، مقسّمة حسب الصف الدراسي.',
};

// No login wall. A visitor arriving from a WhatsApp link sees every lecture,
// its price and its contents before being asked for anything — which is the
// entire point, and the opposite of the incumbent's
// "يجب تسجيل الدخول أولاً لمشاهدة الكورسات".
export default async function LecturesPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const { grade } = await searchParams;
  const activeGrade = GRADES.includes(grade as Grade) ? (grade as Grade) : undefined;

  const { lectures, total } = await getCatalog({ grade: activeGrade, limit: 60 });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">المحاضرات</h1>
        <p className="text-sm text-muted">{total} محاضرة متاحة</p>
      </div>

      <nav aria-label="تصفية حسب الصف" className="flex flex-wrap gap-2">
        <FilterPill href="/lectures" label="كل الصفوف" active={!activeGrade} />
        {GRADES.map((g) => (
          <FilterPill
            key={g}
            href={`/lectures?grade=${g}`}
            label={GRADE_LABELS_AR[g]}
            active={activeGrade === g}
          />
        ))}
      </nav>

      {lectures.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          لا توجد محاضرات متاحة في هذا الصف حالياً.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lectures.map((lecture) => (
            <LectureCard key={lecture._id} lecture={lecture} />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active
          ? 'border-brand bg-brand text-brand-contrast'
          : 'border-border text-muted hover:border-brand/40 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
