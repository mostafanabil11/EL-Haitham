'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import type { AdminSettings } from '@/lib/admin-api';

function text(form: FormData, key: string): string | null {
  const value = String(form.get(key) ?? '').trim();
  return value || null;
}

export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    // The API wants digits only — no +, no spaces, no leading zero — because
    // the value is pasted straight into a wa.me URL. Normalising here means
    // the teacher can type it however he reads it off his own phone.
    const whatsapp = String(form.get('whatsappNumber') ?? '').replace(/\D/g, '');
    const normalisedWhatsapp = whatsapp.startsWith('0') ? `20${whatsapp.slice(1)}` : whatsapp;

    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          siteName: String(form.get('siteName') ?? '').trim(),
          tagline: text(form, 'tagline'),
          teacherName: text(form, 'teacherName'),
          teacherBio: text(form, 'teacherBio'),
          whatsappNumber: normalisedWhatsapp || null,
          socialLinks: {
            facebook: text(form, 'facebook'),
            youtube: text(form, 'youtube'),
            tiktok: text(form, 'tiktok'),
            instagram: text(form, 'instagram'),
          },
          isRegistrationOpen: form.get('isRegistrationOpen') === 'on',
          currentAcademicYear: String(form.get('currentAcademicYear') ?? '').trim(),
          purchaseRequestExpiryHours: Number(form.get('purchaseRequestExpiryHours') ?? 48),
          defaultAccessDurationDays: form.get('defaultAccessDurationDays')
            ? Number(form.get('defaultAccessDurationDays'))
            : null,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر حفظ الإعدادات.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">الموقع</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput name="siteName" label="اسم الموقع" defaultValue={settings.siteName} required />
          <TextInput name="tagline" label="الوصف المختصر" defaultValue={settings.tagline ?? ''} />
          <TextInput name="teacherName" label="اسم المدرس" defaultValue={settings.teacherName ?? ''} />
          <TextInput
            name="whatsappNumber"
            label="رقم واتساب"
            hint="الرقم الذي تصل عليه طلبات الاشتراك"
            defaultValue={settings.whatsappNumber ?? ''}
            dir="ltr"
          />
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">نبذة عن المدرس</span>
            <textarea
              name="teacherBio"
              rows={3}
              maxLength={2000}
              defaultValue={settings.teacherBio ?? ''}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">روابط التواصل</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput name="facebook" label="فيسبوك" defaultValue={settings.socialLinks.facebook ?? ''} dir="ltr" type="url" />
          <TextInput name="youtube" label="يوتيوب" defaultValue={settings.socialLinks.youtube ?? ''} dir="ltr" type="url" />
          <TextInput name="tiktok" label="تيك توك" defaultValue={settings.socialLinks.tiktok ?? ''} dir="ltr" type="url" />
          <TextInput name="instagram" label="إنستجرام" defaultValue={settings.socialLinks.instagram ?? ''} dir="ltr" type="url" />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">التشغيل</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            name="currentAcademicYear"
            label="العام الدراسي الحالي"
            hint="يحدد العام الافتراضي للترمات الجديدة"
            defaultValue={settings.currentAcademicYear}
            dir="ltr"
            pattern="\d{4}/\d{4}"
            required
          />
          <TextInput
            name="defaultAccessDurationDays"
            label="مدة الوصول الافتراضية (أيام)"
            hint="فارغ = حتى نهاية العام الدراسي"
            defaultValue={settings.defaultAccessDurationDays?.toString() ?? ''}
            dir="ltr"
            type="number"
          />
          <TextInput
            name="purchaseRequestExpiryHours"
            label="انتهاء الطلب المعلّق (ساعات)"
            hint="يُلغى الطلب تلقائياً بعد هذه المدة"
            defaultValue={String(settings.purchaseRequestExpiryHours)}
            dir="ltr"
            type="number"
            required
          />
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              name="isRegistrationOpen"
              type="checkbox"
              defaultChecked={settings.isRegistrationOpen}
              className="size-4 accent-[var(--brand)]"
            />
            <span>
              التسجيل مفتوح{' '}
              <span className="text-muted">— إغلاقه يمنع إنشاء حسابات جديدة</span>
            </span>
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? '...' : 'حفظ الإعدادات'}
        </button>
        {saved && <span className="text-sm text-success">تم الحفظ</span>}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function TextInput({
  name,
  label,
  hint,
  defaultValue,
  dir,
  type = 'text',
  required,
  pattern,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  dir?: 'ltr';
  type?: string;
  required?: boolean;
  pattern?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      <input
        name={name}
        type={type}
        dir={dir}
        required={required}
        pattern={pattern}
        defaultValue={defaultValue}
        className={`rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40 ${
          dir === 'ltr' ? 'text-start' : ''
        }`}
      />
    </label>
  );
}
