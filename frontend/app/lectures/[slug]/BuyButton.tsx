'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';

type Props = {
  lectureId: string;
  slug: string;
  isSignedIn: boolean;
  fallbackWhatsAppUrl: string | null;
};

// Creates a PurchaseRequest first, then opens WhatsApp with the request number
// in the message. That number is what turns "someone sent me 75 pounds" into a
// row the teacher closes with one click — without it he is reconciling
// payments by scrolling his own chat history, which is how the incumbent works.
export function BuyButton({ lectureId, slug, isSignedIn, fallbackWhatsAppUrl }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!isSignedIn) {
      // Come back to this exact lecture after signing in.
      router.push(`/login?next=/lectures/${slug}`);
      return;
    }

    setPending(true);
    setError(null);

    try {
      const res = await apiFetch<{ data: { whatsappUrl: string | null; requestNumber: string } }>(
        '/purchase-requests',
        {
          method: 'POST',
          body: JSON.stringify({ targetKind: 'lecture', targetId: lectureId }),
        },
      );

      if (res.data.whatsappUrl) {
        window.open(res.data.whatsappUrl, '_blank', 'noopener,noreferrer');
      } else if (fallbackWhatsAppUrl) {
        window.open(fallbackWhatsAppUrl, '_blank', 'noopener,noreferrer');
      } else {
        setError('رقم الواتساب غير مضبوط. تواصل مع المدرس مباشرة.');
      }
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'تعذر إنشاء الطلب. حاول مرة أخرى.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onClick}
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-3 text-center text-base font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? '...' : isSignedIn ? 'اشترك عبر واتساب' : 'سجّل الدخول للاشتراك'}
      </button>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
