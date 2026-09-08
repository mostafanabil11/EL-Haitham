'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import type { PurchaseRequestRow, RequestStatus } from '@/lib/admin-api';
import { Pill, formatDateTimeAr, relativeAr } from '../ui';

const STATUS_TONE: Record<RequestStatus, 'neutral' | 'positive' | 'warning' | 'danger'> = {
  pending: 'warning',
  paid: 'positive',
  cancelled: 'danger',
  expired: 'neutral',
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'معلّق',
  paid: 'مؤكد',
  cancelled: 'ملغي',
  expired: 'منتهي',
};

type ConfirmResult = { requestNumber: string; code: string; whatsappMessage: string };

export function RequestList({ requests }: { requests: PurchaseRequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Keyed by request id rather than held as a single value: the teacher works
  // down the queue, and losing the code the moment he confirms the next one
  // would mean going to the codes screen to find it again.
  const [results, setResults] = useState<Record<string, ConfirmResult>>({});

  async function confirm(request: PurchaseRequestRow) {
    setBusyId(request._id);
    setError(null);
    try {
      const body = await apiFetch<{ data: ConfirmResult }>(
        `/admin/purchase-requests/${request._id}/confirm`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setResults((prev) => ({ ...prev, [request._id]: body.data }));
      // Deliberately NO router.refresh() here. This screen defaults to the
      // pending filter, so re-fetching would drop the row that was just
      // confirmed — taking the code and the WhatsApp button with it, before
      // the teacher has sent anything. The row stays, marked as confirmed,
      // until he navigates away himself.
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر تأكيد الطلب.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(request: PurchaseRequestRow) {
    // Cancelling is the one destructive action on this screen and it sits next
    // to the confirm button, so it asks first.
    if (!window.confirm(`إلغاء الطلب ${request.requestNumber}؟`)) return;

    setBusyId(request._id);
    setError(null);
    try {
      await apiFetch(`/admin/purchase-requests/${request._id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر إلغاء الطلب.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {requests.map((request) => {
          const result = results[request._id];
          const busy = busyId === request._id;
          // A row confirmed in this session renders as paid without a re-fetch,
          // so the status pill matches what just happened on screen.
          const status = result ? 'paid' : request.status;

          return (
            <li key={request._id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{request.titleSnapshot}</p>
                    <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
                  </div>

                  <p className="mt-1 text-xs text-muted">
                    <span dir="ltr">{request.requestNumber}</span> ·{' '}
                    {formatPrice(request.priceMinorUnits)}
                    {status === 'pending'
                      ? ` · ${relativeAr(request.createdAt)}`
                      : ` · ${formatDateTimeAr(request.createdAt)}`}
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    {request.user ? (
                      <>
                        <Link
                          href={`/admin/students/${request.user._id}`}
                          className="text-link hover:underline"
                        >
                          {request.user.name}
                        </Link>
                        {request.user.grade && ` · ${GRADE_LABELS_AR[request.user.grade as Grade]}`}
                      </>
                    ) : (
                      'حساب محذوف'
                    )}{' '}
                    · <span dir="ltr">{toLocalPhone(request.phone)}</span>
                  </p>
                </div>

                {status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => confirm(request)}
                      disabled={busy}
                      className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
                    >
                      {busy ? '...' : 'تأكيد الدفع'}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancel(request)}
                      disabled={busy}
                      className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:border-red-500/60 hover:text-danger disabled:opacity-60"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>

              {/* An already-confirmed request still shows its code, because the
                  most common follow-up message is "I lost the code". */}
              {!result && request.issuedCode && (
                <p className="mt-3 text-xs text-muted">
                  الكود:{' '}
                  <span dir="ltr" className="font-mono font-semibold text-foreground">
                    {request.issuedCode.code}
                  </span>
                </p>
              )}

              {result && <ConfirmedPanel result={result} phone={request.phone} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * What the teacher sees the instant a payment is confirmed.
 *
 * The code alone is not the deliverable — getting it into the right WhatsApp
 * conversation is. So this offers the finished message and a deep link to that
 * student's chat, which turns the last step from "find the chat, retype the
 * code, hope you typed it right" into one tap.
 */
function ConfirmedPanel({ result, phone }: { result: ConfirmResult; phone: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.whatsappMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied in some in-app browsers. The message is
      // visible above and selectable, so this fails quietly rather than
      // throwing an error at someone mid-sale.
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-success/40 bg-success/10 p-3">
      <p className="text-xs text-muted">تم التأكيد وإصدار الكود</p>
      <p dir="ltr" className="mt-1 text-start font-mono text-lg font-bold tracking-wider">
        {result.code}
      </p>

      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded border border-border bg-background/60 p-2 text-xs text-muted">
        {result.whatsappMessage}
      </pre>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(result.whatsappMessage)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-contrast transition hover:opacity-90"
        >
          إرسال على واتساب
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-brand/40"
        >
          {copied ? 'تم النسخ' : 'نسخ الرسالة'}
        </button>
      </div>
    </div>
  );
}

// Phones are stored canonically as 201XXXXXXXXX; the teacher reads and dials
// the local 01XXXXXXXXX form.
function toLocalPhone(phone: string): string {
  return phone.startsWith('20') ? `0${phone.slice(2)}` : phone;
}
