import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStudent, getAdminLectures } from '@/lib/admin-api';
import { formatPrice, formatDuration } from '@/lib/format';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { PageHeader, EmptyState, Pill, formatDateAr, formatDateTimeAr, relativeAr } from '../../ui';
import { StudentActions } from './StudentActions';
import { EnrollmentRow } from './EnrollmentRow';

export const metadata: Metadata = { title: 'ملف الطالب' };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, lectures] = await Promise.all([getStudent(id), getAdminLectures()]);

  if (!detail) notFound();

  const { student, enrollments, codes, requests, progress, lastActiveAt } = detail;
  const enrolledLectureIds = new Set(
    enrollments.map((enrollment) => enrollment.lecture?._id).filter(Boolean) as string[],
  );

  return (
    <>
      <PageHeader
        title={student.name}
        subtitle={[
          student.grade ? GRADE_LABELS_AR[student.grade as Grade] : 'حساب المدرس',
          `انضم ${formatDateAr(student.createdAt)}`,
          lastActiveAt ? `آخر مشاهدة ${relativeAr(lastActiveAt)}` : 'لم يشاهد شيئاً بعد',
        ].join(' · ')}
        action={
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Straight to this student's row in the report screen, which is
                where a "how is my son doing?" message gets answered. */}
            <Link
              href={`/admin/reports?q=${encodeURIComponent(student.phone)}`}
              className="text-link hover:underline"
            >
              تقرير ولي الأمر
            </Link>
            <Link href="/admin/students" className="text-link hover:underline">
              رجوع للقائمة
            </Link>
          </div>
        }
      />

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">بيانات التواصل</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">هاتف الطالب</dt>
          <dd dir="ltr" className="text-start font-medium">
            <a href={`https://wa.me/${student.phone}`} target="_blank" rel="noopener noreferrer" className="hover:text-link">
              {toLocalPhone(student.phone)}
            </a>
          </dd>
          <dt className="text-muted">هاتف ولي الأمر</dt>
          <dd dir="ltr" className="text-start font-medium">
            <a href={`https://wa.me/${student.parentPhone}`} target="_blank" rel="noopener noreferrer" className="hover:text-link">
              {toLocalPhone(student.parentPhone)}
            </a>
          </dd>
          <dt className="text-muted">البريد الإلكتروني</dt>
          <dd className="font-medium">{student.email ?? 'غير مسجل'}</dd>
        </dl>
      </section>

      <StudentActions
        studentId={student._id}
        studentName={student.name}
        lectures={lectures.filter((lecture) => !enrolledLectureIds.has(lecture._id))}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">الاشتراكات ({enrollments.length})</h2>
        {enrollments.length === 0 ? (
          <EmptyState>لا توجد اشتراكات.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {enrollments.map((enrollment) => (
              <EnrollmentRow key={enrollment._id} enrollment={enrollment} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">التقدّم ({progress.length})</h2>
        {progress.length === 0 ? (
          <EmptyState>لم يبدأ المشاهدة بعد.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {progress.map((row) => (
              <li
                key={row._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{row.lecture?.titleAr ?? 'محاضرة محذوفة'}</p>
                  <p className="text-xs text-muted">
                    وصل إلى {formatDuration(row.furthestSeconds)} · آخر تحديث{' '}
                    {formatDateTimeAr(row.updatedAt)}
                  </p>
                </div>
                {row.completedAt ? (
                  <Pill tone="positive">أكمل</Pill>
                ) : (
                  <Pill tone="neutral">قيد المشاهدة</Pill>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">الأكواد المفعّلة ({codes.length})</h2>
        {codes.length === 0 ? (
          <EmptyState>لم يفعّل أي كود.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {codes.map((code) => (
              <li
                key={code._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p dir="ltr" className="text-start font-mono text-sm font-semibold">
                    {code.code}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {code.lecture?.titleAr ?? code.bundle?.titleAr ?? '—'} ·{' '}
                    {formatDateTimeAr(code.redeemedAt)}
                  </p>
                </div>
                {code.status === 'revoked' && <Pill tone="danger">ملغي</Pill>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">الطلبات ({requests.length})</h2>
        {requests.length === 0 ? (
          <EmptyState>لا توجد طلبات.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((request) => (
              <li
                key={request._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{request.titleSnapshot}</p>
                  <p className="text-xs text-muted">
                    <span dir="ltr">{request.requestNumber}</span> ·{' '}
                    {formatPrice(request.priceMinorUnits)} · {formatDateAr(request.createdAt)}
                  </p>
                </div>
                <Pill
                  tone={
                    request.status === 'paid'
                      ? 'positive'
                      : request.status === 'pending'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {request.status === 'paid'
                    ? 'مؤكد'
                    : request.status === 'pending'
                      ? 'معلّق'
                      : request.status === 'cancelled'
                        ? 'ملغي'
                        : 'منتهي'}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function toLocalPhone(phone: string): string {
  return phone.startsWith('20') ? `0${phone.slice(2)}` : phone;
}
