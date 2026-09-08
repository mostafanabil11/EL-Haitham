import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, getMyEnrollments } from '@/lib/server-api';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { formatDuration } from '@/lib/format';
import { LogoutButton } from './LogoutButton';

export const metadata: Metadata = { title: 'حسابي' };

export default async function DashboardPage() {
  // Gated on the server: an unauthenticated visitor is redirected before any
  // of this page's markup is generated, so protected content never reaches
  // the browser at all.
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');

  const enrollments = await getMyEnrollments();
  const active = enrollments.filter((e) => !e.isExpired);
  const expired = enrollments.filter((e) => e.isExpired);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-5 py-12 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">أهلاً {user.name}</h1>
          <p className="text-sm text-muted">
            {user.grade ? GRADE_LABELS_AR[user.grade as Grade] : 'حساب المدرس'}
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/redeem"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90"
        >
          تفعيل كود
        </Link>
        <Link
          href="/lectures"
          className="rounded-lg border border-border px-4 py-2.5 text-sm transition hover:border-brand/40"
        >
          تصفح المحاضرات
        </Link>
      </div>

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold">محاضراتي ({active.length})</h2>

        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="mb-3 text-sm text-muted">لا توجد محاضرات في حسابك بعد.</p>
            <Link href="/redeem" className="text-sm font-medium text-link hover:underline">
              لديك كود؟ فعّله الآن
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/learn/${e.lecture!.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-5 transition hover:border-brand/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.lecture!.titleAr}</p>
                    <p className="text-xs text-muted">
                      {e.lecture!.itemCount} درس · {formatDuration(e.lecture!.totalDurationSeconds)}
                      {e.expiresAt &&
                        ` · حتى ${new Date(e.expiresAt).toLocaleDateString('ar-EG-u-nu-latn', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-link">مشاهدة</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {expired.length > 0 && (
        <section className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-muted">اشتراكات منتهية ({expired.length})</h2>
          <ul className="flex flex-col gap-2">
            {expired.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-5 opacity-60"
              >
                <p className="truncate text-sm">{e.lecture!.titleAr}</p>
                <span className="shrink-0 text-xs text-muted">منتهي</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="mb-3 text-sm font-semibold">بيانات الحساب</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-4 text-sm">
          <dt className="text-muted">رقم الهاتف</dt>
          <dd dir="ltr" className="text-start font-medium">
            {user.phoneLocal}
          </dd>
          <dt className="text-muted">رقم ولي الأمر</dt>
          <dd dir="ltr" className="text-start font-medium">
            {user.parentPhoneLocal}
          </dd>
          <dt className="text-muted">البريد الإلكتروني</dt>
          <dd className="font-medium">{user.email ?? 'غير مسجل'}</dd>
        </dl>
      </section>
    </main>
  );
}
