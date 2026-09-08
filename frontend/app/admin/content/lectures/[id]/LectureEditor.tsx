'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import type { AdminLectureDetail } from '@/lib/admin-api';
import { Pill, formatDateAr } from '../../../ui';

export function LectureEditor({ lecture }: { lecture: AdminLectureDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pounds = Number(form.get('price') ?? 0);
    const days = String(form.get('accessDurationDays') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();

    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/admin/content/lectures/${lecture._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titleAr: String(form.get('titleAr') ?? '').trim(),
          priceMinorUnits: Math.round(pounds * 100),
          description: description || null,
          // Empty means "use the default", which is the end of the academic
          // year — not "expires immediately", so it must be null and not 0.
          accessDurationDays: days ? Number(days) : null,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر الحفظ.');
    } finally {
      setPending(false);
    }
  }

  async function togglePublish() {
    const next = !lecture.isPublished;
    if (
      !next &&
      !window.confirm('إخفاء المحاضرة من الكتالوج؟ الطلاب المشتركون سيظلون قادرين على المشاهدة.')
    ) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch(`/admin/content/lectures/${lecture._id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ isPublished: next }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر تغيير حالة النشر.');
    } finally {
      setPending(false);
    }
  }

  async function toggleArchive() {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/admin/content/lectures/${lecture._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !lecture.isArchived }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر تنفيذ العملية.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {lecture.isPublished ? <Pill tone="positive">منشورة</Pill> : <Pill tone="warning">مسودة</Pill>}
          {lecture.isArchived && <Pill tone="neutral">مؤرشفة</Pill>}
          {lecture.publishedAt && (
            <span className="text-xs text-muted">نُشرت {formatDateAr(lecture.publishedAt)}</span>
          )}
          <span dir="ltr" className="text-xs text-muted">
            /{lecture.slug}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={togglePublish}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:border-brand/40 disabled:opacity-60"
          >
            {lecture.isPublished ? 'إخفاء' : 'نشر'}
          </button>
          <button
            type="button"
            onClick={toggleArchive}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-brand/40 disabled:opacity-60"
          >
            {lecture.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}
          </button>
        </div>
      </div>

      {/* The slug freezes on publish, so renaming a published lecture changes
          the title everywhere but keeps every WhatsApp link that was already
          shared working. Worth saying out loud on the screen where someone is
          about to rename one. */}
      {lecture.isPublished && (
        <p className="mb-4 rounded-lg border border-border px-3 py-2 text-xs text-muted">
          الرابط ثابت بعد النشر — تغيير العنوان لن يكسر الروابط المُرسلة على واتساب.
        </p>
      )}

      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">العنوان</span>
          <input
            name="titleAr"
            required
            minLength={2}
            maxLength={200}
            defaultValue={lecture.titleAr}
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
            required
            dir="ltr"
            defaultValue={lecture.priceMinorUnits / 100}
            className="form-control text-start text-sm"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            مدة الوصول بالأيام <span className="font-normal text-muted">(فارغ = حتى نهاية العام)</span>
          </span>
          <input
            name="accessDurationDays"
            type="number"
            min={1}
            max={730}
            dir="ltr"
            defaultValue={lecture.accessDurationDays ?? ''}
            className="form-control text-start text-sm"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">
            الوصف <span className="font-normal text-muted">(يظهر في معاينة واتساب)</span>
          </span>
          <textarea
            name="description"
            rows={3}
            maxLength={3000}
            defaultValue={lecture.description ?? ''}
            className="form-control min-h-28 text-sm"
          />
        </label>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? '...' : 'حفظ'}
          </button>
          {saved && <span className="text-sm text-success">تم الحفظ</span>}
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
