import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { LoginForm } from './LoginForm';
import { getCurrentUser } from '@/lib/server-api';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only relative paths are honoured. Echoing an arbitrary ?next= into a
  // redirect is an open-redirect: a link to
  // /login?next=https://evil.example would bounce a student straight off the
  // platform wearing the trust of our own domain.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  // Checked on the server, so an already-signed-in student never sees the
  // form flash before being bounced.
  const user = await getCurrentUser();
  if (user) redirect(safeNext);

  return (
    <AuthCard
      title="تسجيل الدخول"
      subtitle="ادخل برقم هاتفك وكلمة المرور"
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link href="/register" className="font-medium text-brand hover:underline">
            أنشئ حساباً جديداً
          </Link>
        </>
      }
    >
      <LoginForm next={safeNext} />
    </AuthCard>
  );
}
