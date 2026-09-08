'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, FormError, SubmitButton } from '@/components/Field';
import { apiFetch, ApiRequestError } from '@/lib/api';

export function LoginForm({ next = '/dashboard' }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          phone: String(form.get('phone') ?? ''),
          password: String(form.get('password') ?? ''),
        }),
      });

      // refresh() re-runs the server components so the new session cookie is
      // picked up; push alone would render the dashboard from a client cache
      // that still believes nobody is signed in.
      router.refresh();
      router.push(next);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError('تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.');
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />

      <Field
        label="رقم الهاتف"
        name="phone"
        type="tel"
        inputMode="tel"
        placeholder="01012345678"
        autoComplete="tel"
        required
        error={fieldErrors.phone}
      />

      <Field
        label="كلمة المرور"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldErrors.password}
      />

      <SubmitButton pending={pending}>تسجيل الدخول</SubmitButton>
    </form>
  );
}
