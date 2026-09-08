'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, SelectField, FormError, SubmitButton } from '@/components/Field';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { GRADE_OPTIONS } from '@/lib/grades';

export function RegisterForm() {
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
    const email = String(form.get('email') ?? '').trim();

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name') ?? '').trim(),
          phone: String(form.get('phone') ?? ''),
          parentPhone: String(form.get('parentPhone') ?? ''),
          grade: String(form.get('grade') ?? ''),
          password: String(form.get('password') ?? ''),
          // Omitted entirely when blank — the backend treats an absent email
          // as "no email", but an empty string would fail its email check.
          ...(email ? { email } : {}),
        }),
      });

      // Registration signs the student straight in, so there is no second
      // login form to fill in on a phone keyboard.
      router.refresh();
      router.push('/dashboard');
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
        label="الاسم بالكامل"
        name="name"
        placeholder="ادخل اسمك بالكامل"
        autoComplete="name"
        required
        error={fieldErrors.name}
      />

      <Field
        label="رقم الهاتف"
        name="phone"
        type="tel"
        inputMode="tel"
        placeholder="01012345678"
        hint="هذا هو الرقم الذي ستسجل الدخول به"
        autoComplete="tel"
        required
        error={fieldErrors.phone}
      />

      <Field
        label="رقم هاتف ولي الأمر"
        name="parentPhone"
        type="tel"
        inputMode="tel"
        placeholder="01012345678"
        hint="لمتابعة تقدمك الدراسي"
        required
        error={fieldErrors.parentPhone}
      />

      <SelectField
        label="الصف الدراسي"
        name="grade"
        options={GRADE_OPTIONS}
        placeholder="اختر الصف الدراسي"
        required
        error={fieldErrors.grade}
      />

      <Field
        label="كلمة المرور"
        name="password"
        type="password"
        hint="8 أحرف على الأقل"
        autoComplete="new-password"
        required
        error={fieldErrors.password}
      />

      <Field
        label="البريد الإلكتروني (اختياري)"
        name="email"
        type="email"
        hint="لاستعادة كلمة المرور بنفسك. بدونه ستحتاج للتواصل مع المدرس."
        autoComplete="email"
        error={fieldErrors.email}
      />

      <SubmitButton pending={pending}>إنشاء حساب</SubmitButton>
    </form>
  );
}
