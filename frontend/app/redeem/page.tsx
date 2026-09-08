import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';
import { RedeemForm } from './RedeemForm';
import { getCurrentUser } from '@/lib/server-api';

export const metadata: Metadata = { title: 'تفعيل كود' };

export default async function RedeemPage() {
  const user = await getCurrentUser();

  // A code binds permanently to an account, so there has to be one first.
  // Carrying the destination through means the student lands back here
  // straight after signing in rather than on a generic dashboard.
  if (!user) redirect('/login?next=/redeem');

  return (
    <AuthCard
      title="تفعيل كود"
      subtitle="أدخل الكود الذي استلمته من المدرس بعد الدفع."
      footer={
        <>
          لم تشترِ بعد؟{' '}
          <Link href="/lectures" className="font-medium text-brand hover:underline">
            تصفح المحاضرات
          </Link>
        </>
      }
    >
      <RedeemForm />
    </AuthCard>
  );
}
