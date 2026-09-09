import Link from 'next/link';
import type { Metadata } from 'next';
import { getAccessCodes, getAdminLectures, type CodeStatus } from '@/lib/admin-api';
import { PageHeader, EmptyState, Pagination } from '../ui';
import { GenerateCodes } from './GenerateCodes';
import { CodeList } from './CodeList';

export const metadata: Metadata = { title: 'الأكواد' };

const TABS: { value: CodeStatus | 'all'; label: string }[] = [
  { value: 'unused', label: 'غير مستخدمة' },
  { value: 'redeemed', label: 'مستخدمة' },
  { value: 'revoked', label: 'ملغاة' },
  { value: 'all', label: 'الكل' },
];

export default async function CodesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; batchId?: string; lectureId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? 'all';
  const page = Number(params.page ?? 1) || 1;

  const [{ items, pagination }, lectures] = await Promise.all([
    getAccessCodes({
      status: status === 'all' ? undefined : status,
      batchId: params.batchId,
      lectureId: params.lectureId,
      page,
    }),
    getAdminLectures(),
  ]);

  return (
    <>
      <PageHeader
        title="أكواد التفعيل"
        subtitle="كل كود يُستخدم مرة واحدة ويرتبط بالحساب الذي فعّله."
      />

      <GenerateCodes lectures={lectures} />

      <nav className="-mx-1 mb-4 mt-8 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/codes?status=${tab.value}`}
            aria-current={status === tab.value ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
              status === tab.value
                ? 'bg-brand text-brand-contrast font-semibold'
                : 'border border-border text-muted hover:border-brand/40'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* A batch filter arrives as a link from the generate panel, so it needs
          a visible way back out — otherwise the list silently shows 12 of 300
          codes and looks broken. */}
      {/* A lecture filter arrives as a link from that lecture's page and needs
          the same way back out as a batch filter — otherwise the list silently
          shows a handful of 300 codes and looks broken. */}
      {params.lectureId && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted">محاضرة واحدة</span>
          <Link href="/admin/codes" className="text-xs text-link hover:underline">
            عرض كل الأكواد
          </Link>
        </div>
      )}

      {params.batchId && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <span className="text-muted">دفعة:</span>
          <span dir="ltr" className="font-mono">
            {params.batchId}
          </span>
          <Link href="/admin/codes" className="text-xs text-link hover:underline">
            إزالة الفلتر
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState>لا توجد أكواد بهذه الحالة.</EmptyState>
      ) : (
        <CodeList codes={items} />
      )}

      <Pagination
        page={pagination.page}
        pages={pagination.pages}
        basePath="/admin/codes"
        params={{ status, batchId: params.batchId, lectureId: params.lectureId }}
      />
    </>
  );
}
