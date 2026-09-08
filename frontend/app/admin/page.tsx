import Link from 'next/link';
import { getOverview } from '@/lib/admin-api';
import { formatPrice, formatDuration } from '@/lib/format';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { PageHeader, StatCard, EmptyState, Pill, relativeAr } from './ui';

export default async function AdminOverviewPage() {
  const overview = await getOverview();

  if (!overview) {
    return (
      <>
        <PageHeader title="نظرة عامة" />
        <EmptyState>تعذّر تحميل البيانات. تأكد أن الخادم يعمل ثم أعد المحاولة.</EmptyState>
      </>
    );
  }

  const { students, revenueThisMonth, mostWatched, oldestPending } = overview;

  return (
    <>
      <PageHeader
        title="نظرة عامة"
        subtitle={`${students.total} طالب · ${overview.publishedLectures} محاضرة منشورة`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* First card, and the only coloured one: it is the only number that
            means a person is waiting for the teacher to do something. */}
        <StatCard
          label="طلبات في انتظار التأكيد"
          value={overview.pendingRequests}
          href="/admin/requests"
          emphasis={overview.pendingRequests > 0}
          hint={overview.pendingRequests > 0 ? 'اضغط للمراجعة' : 'لا شيء معلّق'}
        />
        <StatCard
          label="إيراد هذا الشهر"
          value={formatPrice(revenueThisMonth.minorUnits)}
          hint={`${revenueThisMonth.confirmedRequests} عملية مؤكدة`}
        />
        <StatCard
          label="اشتراكات فعّالة"
          value={overview.activeEnrollments}
          hint="غير منتهية وغير ملغاة"
        />
        <StatCard
          label="أكواد غير مستخدمة"
          value={overview.unusedCodes}
          href="/admin/codes?status=unused"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إجمالي الطلاب" value={students.total} href="/admin/students" />
        <StatCard label="طلاب جدد هذا الشهر" value={students.newThisMonth} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">أقدم الطلبات المعلّقة</h2>
          <Link href="/admin/requests" className="text-sm text-brand hover:underline">
            كل الطلبات
          </Link>
        </div>

        {oldestPending.length === 0 ? (
          <EmptyState>لا توجد طلبات معلّقة. كل شيء مؤكد.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {oldestPending.map((request) => (
              <li
                key={request._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{request.titleSnapshot}</p>
                  <p className="text-xs text-muted">
                    {request.user?.name ?? 'حساب محذوف'} ·{' '}
                    <span dir="ltr">{request.requestNumber}</span> · {relativeAr(request.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone="warning">{formatPrice(request.priceMinorUnits)}</Pill>
                  <Link href="/admin/requests" className="text-xs text-brand hover:underline">
                    تأكيد
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">الأكثر مشاهدة</h2>

        {mostWatched.length === 0 ? (
          <EmptyState>لا توجد مشاهدات مسجّلة بعد.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {mostWatched.map((lecture) => (
              <li
                key={lecture.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{lecture.titleAr}</p>
                  <p className="text-xs text-muted">
                    {GRADE_LABELS_AR[lecture.grade as Grade] ?? lecture.grade} ·{' '}
                    {formatDuration(lecture.seconds)} إجمالي المشاهدة
                  </p>
                </div>
                <Pill tone="positive">{lecture.watchers} طالب</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
