'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import type { AdminLecture } from '@/lib/admin-api';

/**
 * The two things the teacher does from a student's page, both of which today
 * happen over WhatsApp and then get forgotten: granting access without a code
 * (a scholarship, a payment he took in person, a support case where the code
 * was lost) and setting a new password.
 *
 * Both are audited server-side. Neither is reachable by a student.
 */
export function StudentActions({
  studentId,
  studentName,
  lectures,
}: {
  studentId: string;
  studentName: string;
  lectures: AdminLecture[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<'grant' | 'password' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const grantable = lectures.filter((lecture) => !lecture.isArchived);

  async function grant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lectureId = String(new FormData(event.currentTarget).get('lectureId') ?? '');
    if (!lectureId) return;

    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch('/admin/enrollments/grant', {
        method: 'POST',
        body: JSON.stringify({ userId: studentId, lectureId }),
      });
      setNotice('تم منح الوصول.');
      setPanel(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر منح الوصول.');
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newPassword = String(new FormData(event.currentTarget).get('newPassword') ?? '');

    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/auth/admin/students/${studentId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      // Echoed back deliberately: the teacher has to read this out over
      // WhatsApp, and a student with no email has no other way to learn it.
      setNotice(`تم تغيير كلمة المرور. أرسلها للطالب: ${newPassword}`);
      setPanel(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر تغيير كلمة المرور.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setPanel(panel === 'grant' ? null : 'grant');
            setError(null);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-brand/40"
        >
          منح وصول لمحاضرة
        </button>
        <button
          type="button"
          onClick={() => {
            setPanel(panel === 'password' ? null : 'password');
            setError(null);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-brand/40"
        >
          تغيير كلمة المرور
        </button>
      </div>

      {notice && (
        <p className="mt-3 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-sm text-success">
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {panel === 'grant' && (
        <form onSubmit={grant} className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
          <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">المحاضرة</span>
            <select
              name="lectureId"
              required
              defaultValue=""
              className="form-control text-sm"
            >
              <option value="" disabled>
                اختر محاضرة
              </option>
              {grantable.map((lecture) => (
                <option key={lecture._id} value={lecture._id}>
                  {lecture.titleAr} — {GRADE_LABELS_AR[lecture.grade as Grade] ?? lecture.grade} —{' '}
                  {formatPrice(lecture.priceMinorUnits)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending || grantable.length === 0}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? '...' : 'منح'}
          </button>
          <p className="w-full text-xs text-muted">
            يمنح {studentName} الوصول بدون كود. يُسجَّل في سجل العمليات.
            {grantable.length === 0 && ' — لا توجد محاضرات متاحة للمنح.'}
          </p>
        </form>
      )}

      {panel === 'password' && (
        <form onSubmit={resetPassword} className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
          <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">كلمة المرور الجديدة</span>
            <input
              name="newPassword"
              type="text"
              required
              minLength={8}
              maxLength={128}
              dir="ltr"
              autoComplete="off"
              placeholder="8 أحرف على الأقل"
              className="form-control text-start text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? '...' : 'تعيين'}
          </button>
          {/* type="text", not password: the teacher must be able to read what
              he is about to dictate over WhatsApp. Nobody is shoulder-surfing
              his laptop, and a masked field here causes typos he cannot see. */}
          <p className="w-full text-xs text-muted">
            ستظهر كلمة المرور بعد الحفظ لترسلها للطالب. يُسجَّل في سجل العمليات.
          </p>
        </form>
      )}
    </section>
  );
}
