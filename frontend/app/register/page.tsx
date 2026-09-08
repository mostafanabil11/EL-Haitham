import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { RegisterForm } from './RegisterForm';
import { getCurrentUser, getPublicSettings } from '@/lib/server-api';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default async function RegisterPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getPublicSettings()]);
  if (user) redirect('/dashboard');

  // The teacher can close signups between academic years. Rendering the
  // closed state on the server means the form never appears at all, rather
  // than appearing and failing on submit.
  if (settings && settings.isRegistrationOpen === false) {
    return (
      <AuthCard title="التسجيل مغلق حالياً" subtitle="تواصل مع المدرس لمعرفة موعد فتح التسجيل.">
        <Link href="/" className="text-sm font-medium text-brand hover:underline">
          العودة للرئيسية
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="إنشاء حساب جديد"
      subtitle="التسجيل مجاني. الاشتراك في المحاضرات يتم بعد ذلك."
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="font-medium text-brand hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
