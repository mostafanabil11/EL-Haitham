'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { formatPrice, formatDuration } from '@/lib/format';
import type { AdminTerm, AdminLecture } from '@/lib/admin-api';
import { Pill } from '../ui';

export function TermSection({ term, lectures }: { term: AdminTerm; lectures: AdminLecture[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLecture(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pounds = Number(form.get('price') ?? 0);

    setPending(true);
    setError(null);
    try {
      await apiFetch('/admin/content/lectures', {
        method: 'POST',
        body: JSON.stringify({
          titleAr: String(form.get('titleAr') ?? '').trim(),
          termId: term._id,
          // The form asks for pounds because that is what a price is called in
          // conversation; the API stores piastres. Rounding here rather than
          // in the DTO keeps the integer rule honest at the boundary.
          priceMinorUnits: Math.round(pounds * 100),
        }),
      });
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر إنشاء المحاضرة.');
    } finally {
      setPending(false);
    }
  }

  async function archiveTerm() {
    if (!window.confirm(`أرشفة "${term.titleAr}"؟ ستختفي محاضراته من الكتالوج.`)) return;

    setPending(true);
    setError(null);
    try {
      await apiFetch(`/admin/content/terms/${term._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !term.isArchived }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر تنفيذ العملية.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{term.titleAr}</h3>
          <span dir="ltr" className="text-xs text-muted">
            {term.academicYear}
          </span>
          {term.isArchived && <Pill tone="neutral">مؤرشف</Pill>}
          <span className="text-xs text-muted">· {lectures.length} محاضرة</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:border-brand/40"
          >
            إضافة محاضرة
          </button>
          <button
            type="button"
            onClick={archiveTerm}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-brand/40 disabled:opacity-60"
          >
            {term.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={createLecture} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">عنوان المحاضرة</span>
            <input
              name="titleAr"
              required
              minLength={2}
              maxLength={200}
              placeholder="المحاضرة الأولى — الجملة الاسمية"
              className="form-control text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">السعر (ج.م)</span>
            <input
              name="price"
              type="number"
              min={0}
              step={1}
              defaultValue={75}
              required
              dir="ltr"
              className="form-control w-28 text-start text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? '...' : 'إنشاء'}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {lectures.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {lectures.map((lecture) => (
            <li key={lecture._id}>
              <Link
                href={`/admin/content/lectures/${lecture._id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition hover:border-brand/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm">{lecture.titleAr}</p>
                    {lecture.isPublished ? (
                      <Pill tone="positive">منشورة</Pill>
                    ) : (
                      <Pill tone="warning">مسودة</Pill>
                    )}
                    {lecture.isArchived && <Pill tone="neutral">مؤرشفة</Pill>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatPrice(lecture.priceMinorUnits)} · {lecture.itemCount} درس ·{' '}
                    {formatDuration(lecture.totalDurationSeconds)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-link">تحرير</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
