'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import type { AdminLecture } from '@/lib/admin-api';
import { downloadCsv } from './csv';

type GenerateResult = { batchId: string; codes: string[] };

/**
 * Bulk generation, for the case the WhatsApp flow does not cover: handing out
 * printed codes at a centre or to a school. The per-sale path never comes here
 * — confirming a purchase request mints its own code.
 */
export function GenerateCodes({ lectures }: { lectures: AdminLecture[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const sellable = lectures.filter((lecture) => !lecture.isArchived);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetId = String(form.get('lectureId') ?? '');
    const count = Number(form.get('count') ?? 0);
    const note = String(form.get('note') ?? '').trim();

    if (!targetId) {
      setError('اختر المحاضرة أولاً.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const body = await apiFetch<{ data: GenerateResult }>('/admin/access-codes/generate', {
        method: 'POST',
        body: JSON.stringify({
          targetKind: 'lecture',
          targetId,
          count,
          ...(note ? { note } : {}),
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90"
      >
        إنشاء أكواد
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">إنشاء دفعة أكواد</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult(null);
            setError(null);
          }}
          className="text-sm text-muted hover:text-foreground"
        >
          إغلاق
        </button>
      </div>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[2fr_auto_2fr_auto]">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">المحاضرة</span>
          <select
            name="lectureId"
            required
            defaultValue=""
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40"
          >
            <option value="" disabled>
              اختر محاضرة
            </option>
            {sellable.map((lecture) => (
              <option key={lecture._id} value={lecture._id}>
                {lecture.titleAr} — {GRADE_LABELS_AR[lecture.grade as Grade] ?? lecture.grade} —{' '}
                {formatPrice(lecture.priceMinorUnits)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">العدد</span>
          <input
            name="count"
            type="number"
            min={1}
            max={500}
            defaultValue={10}
            required
            dir="ltr"
            className="w-24 rounded-lg border border-border bg-transparent px-3 py-2.5 text-start text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            ملاحظة <span className="font-normal text-muted">(اختياري)</span>
          </span>
          <input
            name="note"
            type="text"
            maxLength={300}
            placeholder="مثال: سنتر النور — دفعة يناير"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/40"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="self-end rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? '...' : 'إنشاء'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-500">
          {error}
        </p>
      )}

      {sellable.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          لا توجد محاضرات بعد.{' '}
          <Link href="/admin/content" className="text-brand hover:underline">
            أضف محاضرة أولاً
          </Link>
          .
        </p>
      )}

      {result && <GeneratedBatch result={result} />}
    </div>
  );
}

function GeneratedBatch({ result }: { result: GenerateResult }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(result.codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
      <p className="text-sm">
        تم إنشاء {result.codes.length} كود · دفعة{' '}
        <span dir="ltr" className="font-mono">
          {result.batchId}
        </span>
      </p>

      {/* Shown in full, not summarised: this is the only moment the batch
          exists as a list the teacher can copy in one go. */}
      <pre className="mt-2 max-h-48 overflow-auto rounded border border-border bg-background/60 p-2 text-start font-mono text-xs" dir="ltr">
        {result.codes.join('\n')}
      </pre>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyAll}
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-brand/60"
        >
          {copied ? 'تم النسخ' : 'نسخ الكل'}
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `codes-${result.batchId}.csv`,
              ['code'],
              result.codes.map((code) => [code]),
            )
          }
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-brand/60"
        >
          تنزيل CSV
        </button>
        <Link
          href={`/admin/codes?batchId=${encodeURIComponent(result.batchId)}`}
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-brand/60"
        >
          عرض الدفعة
        </Link>
      </div>
    </div>
  );
}
