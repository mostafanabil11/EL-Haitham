import type { Metadata } from 'next';
import { getReports } from '@/lib/admin-api';
import { PageHeader, EmptyState, Pagination } from '../ui';
import { ReportList } from './ReportList';

export const metadata: Metadata = { title: 'تقارير أولياء الأمور' };

/** The last six months, newest first, as {value: "2026-09", label: "سبتمبر 2026"}. */
function recentMonths(count = 6) {
  const names = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${names[d.getMonth()]} ${d.getFullYear()}`,
    };
  });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const months = recentMonths();
  const month = params.month ?? months[0].value;
  const q = params.q?.trim() || undefined;
  const page = Number(params.page ?? 1) || 1;

  const { items, pagination } = await getReports({ month, q, page });

  return (
    <>
      <PageHeader
        title="تقارير أولياء الأمور"
        subtitle="ملخص شهري لكل طالب، جاهز للإرسال على واتساب لرقم ولي الأمر بضغطة واحدة."
      />

      {/* A plain GET form: a chosen month and search is a real URL the teacher
          can bookmark, and the back button behaves. */}
      <form method="get" className="mb-8 flex flex-wrap gap-3">
        <select name="month" defaultValue={month} className="form-control w-auto min-w-44">
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <input
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="ابحث بالاسم أو رقم الهاتف"
          className="form-control min-w-56 flex-1"
        />

        <button
          type="submit"
          className="shrink-0 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-contrast transition hover:opacity-90"
        >
          عرض
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState>{q ? 'لا توجد نتائج لهذا البحث.' : 'لا يوجد طلاب بعد.'}</EmptyState>
      ) : (
        <ReportList reports={items} />
      )}

      <Pagination
        page={pagination.page}
        pages={pagination.pages}
        basePath="/admin/reports"
        params={{ month, q }}
      />
    </>
  );
}
