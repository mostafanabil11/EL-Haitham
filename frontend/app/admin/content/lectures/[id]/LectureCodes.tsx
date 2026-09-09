'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { formatPrice } from '@/lib/format';

type GenerateResult = { batchId: string; codes: string[] };

/**
 * Codes for this lecture, issued from the lecture itself.
 *
 * The bulk screen asks which lecture first, because it serves the
 * hand-them-out-at-a-centre case. Standing on one lecture, that question is
 * already answered — and picking the right title out of a dropdown of a
 * hundred is exactly where the wrong code gets issued to a paying student.
 *
 * Defaults to one code, because the common reason to be here is that somebody
 * just paid.
 */
export function LectureCodes({
  lectureId,
  lectureTitle,
  priceMinorUnits,
  unusedCount,
  className = '',
}: {
  lectureId: string;
  lectureTitle: string;
  priceMinorUnits: number;
  unusedCount: number;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate(count: number) {
    setPending(true);
    setError(null);
    try {
      const body = await apiFetch<{ data: GenerateResult }>('/admin/access-codes/generate', {
        method: 'POST',
        body: JSON.stringify({
          targetKind: 'lecture',
          targetId: lectureId,
          count,
          note: `من صفحة المحاضرة: ${lectureTitle}`,
        }),
      });
      setResult(body.data);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر إنشاء الأكواد.');
    } finally {
      setPending(false);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  // The message the teacher actually sends, not just the bare code — the same
  // shape the purchase-request confirmation produces, so a code issued either
  // way reaches the student looking identical.
  const messageFor = (code: string) =>
    `كود تفعيل ${lectureTitle}\n\nالكود: ${code}\n\nفعّله من صفحة «تفعيل كود» على المنصة.`;

  return (
    <section className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">أكواد هذه المحاضرة</h2>
          <p className="mt-1 text-xs text-muted">
            {unusedCount > 0
              ? `${unusedCount} كود غير مستخدم جاهز للإرسال · السعر ${formatPrice(priceMinorUnits)}`
              : `لا توجد أكواد غير مستخدمة · السعر ${formatPrice(priceMinorUnits)}`}
          </p>
        </div>

        <Link
          href={`/admin/codes?lectureId=${lectureId}`}
          className="text-sm text-link hover:underline"
        >
          كل أكواد المحاضرة
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => generate(1)}
          disabled={pending}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? '...' : 'إنشاء كود'}
        </button>
        {[5, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => generate(n)}
            disabled={pending}
            className="rounded-xl border border-border px-4 py-2.5 text-sm transition hover:border-brand/40 disabled:opacity-60"
          >
            {n} أكواد
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-success/40 bg-success/10 p-4">
          <p className="text-sm">
            تم إنشاء {result.codes.length} كود · دفعة{' '}
            <span dir="ltr" className="font-mono">
              {result.batchId}
            </span>
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {result.codes.map((code) => (
              <li key={code} className="flex flex-wrap items-center gap-2">
                <span dir="ltr" className="font-mono text-base font-bold tracking-wider">
                  {code}
                </span>
                <button
                  type="button"
                  onClick={() => copy(code, code)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs transition hover:border-brand/40"
                >
                  {copied === code ? 'تم النسخ' : 'نسخ الكود'}
                </button>
                <button
                  type="button"
                  onClick={() => copy(messageFor(code), `msg-${code}`)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs transition hover:border-brand/40"
                >
                  {copied === `msg-${code}` ? 'تم النسخ' : 'نسخ الرسالة'}
                </button>
              </li>
            ))}
          </ul>

          {result.codes.length > 1 && (
            <button
              type="button"
              onClick={() => copy(result.codes.join('\n'), 'all')}
              className="mt-3 rounded-lg border border-border bg-card px-3 py-1.5 text-xs transition hover:border-brand/40"
            >
              {copied === 'all' ? 'تم النسخ' : 'نسخ الكل'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
