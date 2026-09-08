import Link from 'next/link';
import type { Metadata } from 'next';
import { getStudents } from '@/lib/admin-api';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { PageHeader, EmptyState, Pagination, Pill, formatDateAr } from '../ui';

export const metadata: Metadata = { title: 'الطلاب' };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = Number(params.page ?? 1) || 1;

  const { items, pagination } = await getStudents({ q, page });

  return (
    <>
      <PageHeader title="الطلاب" subtitle={`${pagination.total} حساب`} />

      {/* A plain GET form, so a search is a real URL the teacher can bookmark
          or send to himself, and the back button behaves. */}
      <form method="get" className="mb-5 flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="ابحث برقم الهاتف أو رقم ولي الأمر أو الاسم"
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/40"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90"
        >
          بحث
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState>{q ? 'لا توجد نتائج لهذا البحث.' : 'لا يوجد طلاب بعد.'}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((student) => (
            <li key={student._id}>
              <Link
                href={`/admin/students/${student._id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition hover:border-brand/60"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{student.name}</p>
                    {student.role === 'admin' && <Pill>مدرس</Pill>}
                    {!student.isActive && <Pill tone="danger">موقوف</Pill>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    <span dir="ltr">{toLocalPhone(student.phone)}</span>
                    {student.grade && ` · ${GRADE_LABELS_AR[student.grade as Grade]}`}
                    {` · انضم ${formatDateAr(student.createdAt)}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-brand">التفاصيل</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={pagination.page} pages={pagination.pages} basePath="/admin/students" params={{ q }} />
    </>
  );
}

function toLocalPhone(phone: string): string {
  return phone.startsWith('20') ? `0${phone.slice(2)}` : phone;
}
