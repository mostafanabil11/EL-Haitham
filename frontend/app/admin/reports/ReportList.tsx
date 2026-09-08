'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { StudentReport } from '@/lib/admin-api';
import { Pill, relativeAr } from '../ui';

export function ReportList({ reports }: { reports: StudentReport[] }) {
  const withLectures = reports.filter((r) => r.lectureCount > 0);
  const withoutLectures = reports.filter((r) => r.lectureCount === 0);

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-3">
        {withLectures.map((report) => (
          <ReportRow key={report.studentId} report={report} />
        ))}
      </ul>

      {/*
        Students with nothing to report are separated rather than hidden. The
        teacher still needs to see them — a student who bought nothing this
        month is exactly who a parent message might win back — but they are not
        what the screen is for, so they do not dilute the sendable list.
      */}
      {withoutLectures.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">
            بدون اشتراكات هذا الشهر ({withoutLectures.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {withoutLectures.map((report) => (
              <li
                key={report.studentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/students/${report.studentId}`}
                    className="truncate text-sm font-medium hover:text-link"
                  >
                    {report.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {report.grade ?? '—'} · <span dir="ltr">{report.phoneLocal}</span>
                  </p>
                </div>
                <Pill tone="neutral">لا توجد محاضرات</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReportRow({ report }: { report: StudentReport }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(report.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some in-app browsers. The message is visible
      // and selectable below, so this fails quietly.
      setCopied(false);
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/students/${report.studentId}`}
              className="text-sm font-semibold hover:text-link"
            >
              {report.name}
            </Link>
            {report.grade && <Pill tone="neutral">{report.grade}</Pill>}
            {report.completedCount > 0 && (
              <Pill tone="positive">أكمل {report.completedCount}</Pill>
            )}
          </div>

          <p className="mt-2 text-xs text-muted">
            {report.lectureCount} محاضرة · متوسط المشاهدة {report.averagePercent}% ·{' '}
            {report.lastActiveAt ? `آخر مشاهدة ${relativeAr(report.lastActiveAt)}` : 'لم يشاهد بعد'}
          </p>

          <p className="mt-1 text-xs text-muted">
            ولي الأمر: <span dir="ltr">{report.parentPhoneLocal}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {report.whatsappUrl && (
            <a
              href={report.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast transition hover:opacity-90"
            >
              إرسال لولي الأمر
            </a>
          )}
          <button
            type="button"
            onClick={copy}
            className="rounded-xl border border-border px-4 py-2 text-sm transition hover:border-brand/40"
          >
            {copied ? 'تم النسخ' : 'نسخ'}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted transition hover:border-brand/40"
          >
            {open ? 'إخفاء' : 'معاينة'}
          </button>
        </div>
      </div>

      {/* Per-lecture bars, always visible: they are the substance of the report
          and the teacher scans them to decide who needs a nudge. */}
      <ul className="mt-4 flex flex-col gap-2">
        {report.lectures.map((lecture) => (
          <li key={lecture.lectureId} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-xs">{lecture.titleAr}</span>
            <span
              aria-hidden
              className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-trough sm:w-40"
            >
              <span
                className={`block h-full rounded-full ${
                  lecture.isComplete ? 'bg-success' : 'bg-brand'
                }`}
                style={{ width: `${Math.max(lecture.percentWatched, lecture.hasStarted ? 3 : 0)}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-end text-xs tabular-nums text-muted">
              {lecture.hasStarted ? `${lecture.percentWatched}%` : '—'}
            </span>
          </li>
        ))}
      </ul>

      {open && (
        <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-trough p-3 text-xs leading-relaxed text-muted">
          {report.message}
        </pre>
      )}
    </li>
  );
}
