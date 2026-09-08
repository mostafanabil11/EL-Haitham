'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { GRADE_OPTIONS } from '@/lib/grades';

/** Sept–Aug academic year, written the way an Egyptian school writes it. */
function currentAcademicYear(): string {
  const now = new Date();
  // The year rolls in September, not January — a lecture created in October
  // belongs to the year that started that September.
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

export function CreateTerm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(null);
    try {
      await apiFetch('/admin/content/terms', {
        method: 'POST',
        body: JSON.stringify({
          titleAr: String(form.get('titleAr') ?? '').trim(),
          grade: String(form.get('grade') ?? ''),
          academicYear: String(form.get('academicYear') ?? ''),
        }),
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر إنشاء الترم.');
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
        إضافة ترم
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">ترم جديد</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-foreground">
          إغلاق
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">اسم الترم</span>
          <input
            name="titleAr"
            required
            minLength={2}
            maxLength={120}
            placeholder="الترم الأول"
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/40"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">الصف</span>
          <select
            name="grade"
            required
            defaultValue=""
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40"
          >
            <option value="" disabled>
              اختر
            </option>
            {GRADE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">العام الدراسي</span>
          <input
            name="academicYear"
            required
            dir="ltr"
            pattern="\d{4}/\d{4}"
            defaultValue={currentAcademicYear()}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-start text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="self-end rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? '...' : 'إنشاء'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
