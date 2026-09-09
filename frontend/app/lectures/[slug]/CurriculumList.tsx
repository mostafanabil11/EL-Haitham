'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import type { LectureOutlineItem } from '@/lib/types';

const TYPE_LABEL: Record<LectureOutlineItem['type'], string> = {
  video: 'فيديو',
  pdf: 'ملف',
  text: 'نص',
  live: 'بث مباشر',
};

type Granted = { titleAr: string; slug: string };

/**
 * The curriculum, with the lock as the way in rather than a dead end.
 *
 * A student who already has a code arrives on this page holding it. Sending
 * them to a separate «تفعيل الكود» screen means leaving the lecture they were
 * looking at, and the page they land on has no idea which lecture they came
 * from — so the moment after redeeming they have to find their way back. The
 * lock is where the intent is, so the form belongs here.
 */
export function CurriculumList({
  items,
  slug,
  isSignedIn,
}: {
  items: LectureOutlineItem[];
  slug: string;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<Granted[] | null>(null);

  // Whether the code the student just used actually opened *this* lecture. A
  // code is bound to what the teacher issued it for, so entering one meant for
  // another lecture succeeds — and silently leaving them on a still-locked
  // page would look like the code failed.
  const unlockedThis = granted?.some((g) => g.slug === slug) ?? false;
  const unlockedOther = granted?.filter((g) => g.slug !== slug) ?? [];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '');

    setPending(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: { granted: Granted[] } }>('/access-codes/redeem', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setGranted(res.data.granted);
      // Re-renders the server component, which re-runs the enrollment check
      // and turns the locked rows into a "start watching" button.
      router.refresh();
    } catch (err) {
      // The API distinguishes unknown / already used by you / used by another
      // account / revoked. Those four messages are the whole point — passing
      // them through beats any wording invented here.
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-5"
          >
            <span className="w-6 shrink-0 text-sm text-muted">{index + 1}</span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.titleAr}</p>
              <p className="text-xs text-muted">
                {TYPE_LABEL[item.type]}
                {item.videoDurationSeconds > 0 && ` · ${formatDuration(item.videoDurationSeconds)}`}
              </p>
            </div>

            {item.isFreePreview ? (
              <Link
                href={`/learn/${slug}`}
                className="shrink-0 rounded-full bg-trough px-3 py-2.5 text-xs font-medium text-link transition hover:bg-brand/25"
              >
                شاهد مجاناً
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="shrink-0 rounded-full border border-border px-3 py-2.5 text-xs text-muted transition hover:border-brand/40 hover:text-foreground"
              >
                مقفل — لديك كود؟
              </button>
            )}
          </li>
        ))}
      </ol>

      {open && (
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          {granted ? (
            <div className="flex flex-col gap-4">
              {unlockedThis ? (
                <>
                  <p className="font-semibold text-success">تم التفعيل بنجاح</p>
                  <p className="text-sm text-muted">المحاضرة مفتوحة الآن في حسابك.</p>
                  <Link
                    href={`/learn/${slug}`}
                    className="rounded-xl bg-brand px-4 py-3 text-center text-base font-semibold text-brand-contrast transition hover:opacity-90"
                  >
                    ابدأ المشاهدة
                  </Link>
                </>
              ) : (
                <>
                  {/* Honest about what just happened: the code worked, it was
                      spent, and it opened something else. Saying only "تم
                      التفعيل" while this page stayed locked would read as a
                      bug. */}
                  <p className="font-semibold text-accent">الكود يخص محاضرة أخرى</p>
                  <p className="text-sm text-muted">
                    تم تفعيله بنجاح، لكنه يفتح محاضرة غير هذه. هذه المحاضرة ما زالت مقفلة.
                  </p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {unlockedOther.map((g) => (
                      <li key={g.slug}>
                        •{' '}
                        <Link href={`/learn/${g.slug}`} className="text-link hover:underline">
                          {g.titleAr}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : isSignedIn ? (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="unlock-code" className="text-sm font-medium">
                  أدخل كود التفعيل
                </label>
                <p className="text-xs text-muted">
                  الكود مكوّن من 12 حرفاً ورقماً. لا يهم إن كتبته بحروف صغيرة أو بدون شرطات.
                </p>
                <input
                  id="unlock-code"
                  name="code"
                  required
                  autoFocus
                  dir="ltr"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="XXXX-XXXX-XXXX"
                  className="form-control text-center font-mono text-lg tracking-[0.2em] placeholder:tracking-normal"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-brand px-5 py-3 text-base font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? '...' : 'تفعيل الكود'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  className="rounded-xl border border-border px-5 py-3 text-base transition hover:border-brand/40"
                >
                  إلغاء
                </button>
              </div>
            </form>
          ) : (
            // Redeeming binds a code to an account permanently, so there has to
            // be an account first. Carrying `next` back here means they return
            // to the lecture they were reading rather than a generic dashboard.
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium">لتفعيل الكود تحتاج حساباً أولاً</p>
              <p className="text-sm text-muted">
                الكود يرتبط بحسابك نهائياً بعد التفعيل، لذلك لا بد من تسجيل الدخول قبله.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/login?next=/lectures/${slug}`}
                  className="rounded-xl bg-brand px-5 py-3 text-base font-semibold text-brand-contrast transition hover:opacity-90"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href={`/register?next=/lectures/${slug}`}
                  className="rounded-xl border border-border px-5 py-3 text-base transition hover:border-brand/40"
                >
                  إنشاء حساب
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
