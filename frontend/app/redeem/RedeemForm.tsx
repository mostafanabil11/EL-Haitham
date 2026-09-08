'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { FormError, SubmitButton } from '@/components/Field';

type Granted = { titleAr: string; slug: string };

export function RedeemForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<Granted[] | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setGranted(null);

    const code = String(new FormData(event.currentTarget).get('code') ?? '');

    try {
      const res = await apiFetch<{ message: string; data: { granted: Granted[] } }>(
        '/access-codes/redeem',
        { method: 'POST', body: JSON.stringify({ code }) },
      );
      setGranted(res.data.granted);
      // Refresh so the dashboard's server-rendered lecture list picks up the
      // new enrollment on the next navigation.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',
      );
    } finally {
      setPending(false);
    }
  }

  if (granted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-brand/40 bg-brand/10 px-4 py-3">
          <p className="font-semibold text-link">تم التفعيل بنجاح</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {granted.map((l) => (
              <li key={l.slug}>• {l.titleAr}</li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-brand px-4 py-3 text-base font-semibold text-brand-contrast transition hover:opacity-90"
        >
          مشاهدة محاضراتي
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium">
          كود التفعيل
        </label>
        <p className="text-xs text-muted">
          الكود مكوّن من 12 حرفاً ورقماً. لا يهم إن كتبته بحروف صغيرة أو بدون شرطات.
        </p>
        <input
          id="code"
          name="code"
          required
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX"
          // Centred and letter-spaced: a code is read character by character,
          // and the extra spacing is what makes a mistyped one visible before
          // the student presses the button.
          className="form-control text-center font-mono text-lg tracking-[0.2em] placeholder:tracking-normal"
        />
      </div>

      <SubmitButton pending={pending}>تفعيل الكود</SubmitButton>
    </form>
  );
}
