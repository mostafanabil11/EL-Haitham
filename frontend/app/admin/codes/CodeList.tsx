'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiRequestError } from '@/lib/api';
import type { AccessCodeRow, CodeStatus } from '@/lib/admin-api';
import { Pill, formatDateTimeAr } from '../ui';
import { downloadCsv } from './csv';

const STATUS_TONE: Record<CodeStatus, 'neutral' | 'positive' | 'warning' | 'danger'> = {
  unused: 'warning',
  redeemed: 'positive',
  revoked: 'danger',
};

const STATUS_LABEL: Record<CodeStatus, string> = {
  unused: 'غير مستخدم',
  redeemed: 'مستخدم',
  revoked: 'ملغي',
};

export function CodeList({ codes }: { codes: AccessCodeRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function revoke(code: AccessCodeRow) {
    const warning =
      code.status === 'redeemed'
        ? `الكود ${code.code} مستخدم بالفعل. إلغاؤه لا يسحب المحاضرة من الطالب — لسحب الوصول استخدم صفحة الطالب. متابعة؟`
        : `إلغاء الكود ${code.code}؟`;
    if (!window.confirm(warning)) return;

    setBusyId(code._id);
    setError(null);
    try {
      await apiFetch(`/admin/access-codes/${code._id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'تعذّر إلغاء الكود.');
    } finally {
      setBusyId(null);
    }
  }

  async function copy(code: AccessCodeRow) {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopiedId(code._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setCopiedId(null);
    }
  }

  function exportCsv() {
    downloadCsv(
      `codes-${new Date().toISOString().slice(0, 10)}.csv`,
      ['code', 'status', 'lecture', 'redeemed_by', 'redeemed_phone', 'redeemed_at', 'batch'],
      codes.map((code) => [
        code.code,
        code.status,
        code.lecture?.titleAr ?? code.bundle?.titleAr ?? '',
        code.redeemedBy?.name ?? '',
        code.redeemedBy?.phone ?? '',
        code.redeemedAt ?? '',
        code.batchId ?? '',
      ]),
    );
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-500"
        >
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">{codes.length} كود في هذه الصفحة</p>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:border-brand/60"
        >
          تنزيل CSV
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {codes.map((code) => (
          <li
            key={code._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copy(code)}
                  dir="ltr"
                  title="نسخ"
                  className="font-mono text-sm font-semibold tracking-wider hover:text-brand"
                >
                  {copiedId === code._id ? 'تم النسخ' : code.code}
                </button>
                <Pill tone={STATUS_TONE[code.status]}>{STATUS_LABEL[code.status]}</Pill>
              </div>

              <p className="mt-1 truncate text-xs text-muted">
                {code.lecture?.titleAr ?? code.bundle?.titleAr ?? 'هدف محذوف'}
                {code.batchId && (
                  <>
                    {' · '}
                    <Link
                      href={`/admin/codes?batchId=${encodeURIComponent(code.batchId)}`}
                      className="hover:text-brand"
                      dir="ltr"
                    >
                      {code.batchId}
                    </Link>
                  </>
                )}
              </p>

              {code.redeemedBy && (
                <p className="mt-0.5 text-xs text-muted">
                  فعّله{' '}
                  <Link
                    href={`/admin/students/${code.redeemedBy._id}`}
                    className="text-brand hover:underline"
                  >
                    {code.redeemedBy.name}
                  </Link>{' '}
                  · {formatDateTimeAr(code.redeemedAt)}
                </p>
              )}
            </div>

            {code.status !== 'revoked' && (
              <button
                type="button"
                onClick={() => revoke(code)}
                disabled={busyId === code._id}
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-red-500/60 hover:text-red-500 disabled:opacity-60"
              >
                {busyId === code._id ? '...' : 'إلغاء'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
