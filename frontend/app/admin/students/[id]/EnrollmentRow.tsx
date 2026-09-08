'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiRequestError } from '@/lib/api';
import type { StudentDetail } from '@/lib/admin-api';
import { Pill, formatDateAr } from '../../ui';

type Enrollment = StudentDetail['enrollments'][number];

const SOURCE_LABEL: Record<string, string> = {
  code: 'بكود',
  manual: 'منح يدوي',
  bundle: 'ضمن باقة',
};

export function EnrollmentRow({ enrollment }: { enrollment: Enrollment }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, body: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;

    setPending(true);
    setError(null);
    try {
      await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر تنفيذ العملية.');
    } finally {
      setPending(false);
    }
  }

  const title = enrollment.lecture?.titleAr ?? 'محاضرة محذوفة';

  return (
    <li className="rounded-lg border border-border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {enrollment.lecture ? (
              <Link href={`/lectures/${enrollment.lecture.slug}`} className="truncate text-sm font-medium hover:text-brand">
                {title}
              </Link>
            ) : (
              <span className="truncate text-sm font-medium">{title}</span>
            )}
            {!enrollment.isActive && <Pill tone="danger">ملغى</Pill>}
            {enrollment.isActive && enrollment.isExpired && <Pill tone="neutral">منتهي</Pill>}
            {enrollment.isActive && !enrollment.isExpired && <Pill tone="positive">فعّال</Pill>}
          </div>
          <p className="mt-1 text-xs text-muted">
            {SOURCE_LABEL[enrollment.source] ?? enrollment.source} · منذ{' '}
            {formatDateAr(enrollment.grantedAt)} ·{' '}
            {enrollment.expiresAt ? `حتى ${formatDateAr(enrollment.expiresAt)}` : 'بدون انتهاء'}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => call(`/admin/enrollments/${enrollment._id}/extend`, { days: 30 })}
            className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:border-brand/60 disabled:opacity-60"
          >
            +30 يوم
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              call(
                `/admin/enrollments/${enrollment._id}/active`,
                { isActive: !enrollment.isActive },
                enrollment.isActive
                  ? `سحب الوصول لـ "${title}"؟ الطالب لن يستطيع مشاهدتها بعد الآن.`
                  : undefined,
              )
            }
            className={`rounded-lg border border-border px-3 py-1.5 text-xs transition disabled:opacity-60 ${
              enrollment.isActive
                ? 'text-muted hover:border-red-500/60 hover:text-red-500'
                : 'hover:border-brand/60'
            }`}
          >
            {enrollment.isActive ? 'سحب الوصول' : 'إعادة التفعيل'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
    </li>
  );
}
