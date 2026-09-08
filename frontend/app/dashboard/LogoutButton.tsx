'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Even if the call fails the local session is no longer trustworthy,
      // so send them to the login page regardless.
    }
    router.refresh();
    router.push('/login');
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-border/30 disabled:opacity-60"
    >
      تسجيل الخروج
    </button>
  );
}
