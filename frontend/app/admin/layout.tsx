import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-api';
import { AdminNav } from './AdminNav';

export const metadata: Metadata = {
  title: { default: 'لوحة التحكم', template: '%s | لوحة التحكم' },
  // The admin area must never be indexed, and must never unfurl in a WhatsApp
  // preview if the teacher pastes a link to a student by mistake.
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect('/login?next=/admin');

  // notFound() rather than a redirect: a signed-in student who guesses this
  // URL should learn nothing about whether an admin area exists. The API
  // enforces the same rule independently — this is the second lock, not the
  // only one.
  if (user.role !== 'admin') notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
