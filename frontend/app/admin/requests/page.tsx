import Link from 'next/link';
import type { Metadata } from 'next';
import { getPurchaseRequests, type RequestStatus } from '@/lib/admin-api';
import { PageHeader, EmptyState, Pagination } from '../ui';
import { RequestList } from './RequestList';

export const metadata: Metadata = { title: 'الطلبات' };

const TABS: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'معلّقة' },
  { value: 'paid', label: 'مؤكدة' },
  { value: 'cancelled', label: 'ملغاة' },
  { value: 'expired', label: 'منتهية' },
  { value: 'all', label: 'الكل' },
];

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  // Defaults to the pending queue rather than to everything: this screen is a
  // to-do list first and a ledger second.
  const status = params.status ?? 'pending';
  const page = Number(params.page ?? 1) || 1;

  const { items, pagination } = await getPurchaseRequests({
    status: status === 'all' ? undefined : status,
    page,
  });

  return (
    <>
      <PageHeader
        title="طلبات الاشتراك"
        subtitle="تأكيد الدفع يُصدر الكود تلقائياً ويجهّز رسالة واتساب جاهزة للإرسال."
      />

      <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/requests?status=${tab.value}`}
            aria-current={status === tab.value ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
              status === tab.value
                ? 'bg-brand text-brand-contrast font-semibold'
                : 'border border-border text-muted hover:border-brand/60'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState>
          {status === 'pending' ? 'لا توجد طلبات معلّقة. كل شيء مؤكد.' : 'لا توجد طلبات بهذه الحالة.'}
        </EmptyState>
      ) : (
        <RequestList requests={items} />
      )}

      <Pagination
        page={pagination.page}
        pages={pagination.pages}
        basePath="/admin/requests"
        params={{ status }}
      />
    </>
  );
}
