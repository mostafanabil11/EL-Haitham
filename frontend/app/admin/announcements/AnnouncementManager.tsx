'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { GRADE_OPTIONS, GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import type { AnnouncementRow, AdminLecture, Audience } from '@/lib/admin-api';
import { Pill, formatDateAr } from '../ui';

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'كل الطلاب',
  grade: 'صف دراسي',
  lecture: 'مشتركو محاضرة',
};

export function AnnouncementManager({
  announcements,
  lectures,
}: {
  announcements: AnnouncementRow[];
  lectures: AdminLecture[];
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : fallback);
      return false;
    }
  }

  async function togglePublish(row: AnnouncementRow) {
    setBusyId(row._id);
    await run(
      () =>
        apiFetch(`/admin/announcements/${row._id}/publish`, {
          method: 'POST',
          body: JSON.stringify({ isPublished: !row.isPublished }),
        }),
      'تعذّر تغيير حالة النشر.',
    );
    setBusyId(null);
  }

  async function remove(row: AnnouncementRow) {
    if (!window.confirm(`حذف "${row.titleAr}"؟ لا يمكن التراجع.`)) return;
    setBusyId(row._id);
    await run(
      () => apiFetch(`/admin/announcements/${row._id}`, { method: 'DELETE' }),
      'تعذّر حذف الإعلان.',
    );
    setBusyId(null);
  }

  async function togglePin(row: AnnouncementRow) {
    setBusyId(row._id);
    await run(
      () =>
        apiFetch(`/admin/announcements/${row._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isPinned: !row.isPinned }),
        }),
      'تعذّر تثبيت الإعلان.',
    );
    setBusyId(null);
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {composing ? (
        <Composer
          lectures={lectures}
          onClose={() => setComposing(false)}
          onCreated={() => {
            setComposing(false);
            router.refresh();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90"
        >
          إعلان جديد
        </button>
      )}

      {announcements.length > 0 && (
        <ul className="mt-8 flex flex-col gap-3">
          {announcements.map((row) => (
            <li key={row._id} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{row.titleAr}</h3>
                    {row.isPinned && <Pill tone="warning">مثبّت</Pill>}
                    {row.isPublished ? (
                      <Pill tone="positive">منشور</Pill>
                    ) : (
                      <Pill tone="neutral">مسودة</Pill>
                    )}
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                    {row.bodyAr}
                  </p>

                  <p className="mt-3 text-xs text-muted">
                    {AUDIENCE_LABEL[row.audience]}
                    {row.audience === 'grade' && row.grade && ` · ${GRADE_LABELS_AR[row.grade]}`}
                    {row.audience === 'lecture' && row.lecture && ` · ${row.lecture.titleAr}`}
                    {row.publishedAt && ` · نُشر ${formatDateAr(row.publishedAt)}`}
                    {row.expiresAt && ` · ينتهي ${formatDateAr(row.expiresAt)}`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => togglePublish(row)}
                    disabled={busyId === row._id}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs transition hover:border-brand/40 disabled:opacity-60"
                  >
                    {row.isPublished ? 'إخفاء' : 'نشر'}
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePin(row)}
                    disabled={busyId === row._id}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs transition hover:border-brand/40 disabled:opacity-60"
                  >
                    {row.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    disabled={busyId === row._id}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted transition hover:border-danger/50 hover:text-danger disabled:opacity-60"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Composer({
  lectures,
  onClose,
  onCreated,
}: {
  lectures: AdminLecture[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [audience, setAudience] = useState<Audience>('all');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sellable = lectures.filter((l) => !l.isArchived);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expires = String(form.get('expiresAt') ?? '').trim();

    setPending(true);
    setError(null);
    try {
      await apiFetch('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          titleAr: String(form.get('titleAr') ?? '').trim(),
          bodyAr: String(form.get('bodyAr') ?? '').trim(),
          audience,
          grade: audience === 'grade' ? String(form.get('grade') ?? '') : null,
          lectureId: audience === 'lecture' ? String(form.get('lectureId') ?? '') : null,
          // A date input gives "2026-09-30"; the API wants an instant, and end
          // of day is what "ينتهي في" means to the person typing it.
          expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
          isPinned: form.get('isPinned') === 'on',
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر إنشاء الإعلان.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">إعلان جديد</h2>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
          إغلاق
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm sm:col-span-2">
          <span className="font-medium">العنوان</span>
          <input name="titleAr" required minLength={2} maxLength={200} className="form-control" />
        </label>

        <label className="flex flex-col gap-2 text-sm sm:col-span-2">
          <span className="font-medium">النص</span>
          <textarea
            name="bodyAr"
            required
            rows={4}
            minLength={2}
            maxLength={4000}
            className="form-control"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">من يراه؟</span>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
            className="form-control"
          >
            {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((value) => (
              <option key={value} value={value}>
                {AUDIENCE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>

        {audience === 'grade' && (
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">الصف</span>
            <select name="grade" required defaultValue="" className="form-control">
              <option value="" disabled>
                اختر الصف
              </option>
              {GRADE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {audience === 'lecture' && (
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">المحاضرة</span>
            <select name="lectureId" required defaultValue="" className="form-control">
              <option value="" disabled>
                اختر المحاضرة
              </option>
              {sellable.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.titleAr} — {GRADE_LABELS_AR[l.grade as Grade] ?? l.grade}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">
            ينتهي في <span className="font-normal text-muted">(اختياري)</span>
          </span>
          <input name="expiresAt" type="date" dir="ltr" className="form-control" />
        </label>

        <label className="flex items-center gap-2 self-end text-sm sm:col-span-2">
          <input name="isPinned" type="checkbox" className="size-4 accent-[var(--brand)]" />
          <span>
            تثبيت في الأعلى{' '}
            <span className="text-muted">— للإعلانات المهمة مثل جدول الامتحانات</span>
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Created as a draft on purpose: the teacher writes it, reads it back on
          the list, then publishes. A one-step "write and broadcast" is how a
          typo reaches four hundred students. */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? '...' : 'حفظ كمسودة'}
        </button>
        <span className="text-xs text-muted">لن يظهر للطلاب حتى تضغط «نشر».</span>
      </div>
    </form>
  );
}
