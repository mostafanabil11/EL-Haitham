import type { Metadata } from 'next';
import { getAdminTerms, getAdminLectures } from '@/lib/admin-api';
import { GRADES, GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { PageHeader, EmptyState } from '../ui';
import { TermSection } from './TermSection';
import { CreateTerm } from './CreateTerm';

export const metadata: Metadata = { title: 'المحتوى' };

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const includeArchived = params.archived === '1';

  const [terms, lectures] = await Promise.all([
    getAdminTerms(includeArchived),
    getAdminLectures({ includeArchived }),
  ]);

  // Grouped by grade rather than listed flat. The incumbent's flat list of 117
  // items across four grades is the single thing that makes it unusable, and a
  // flat list here would reproduce it exactly.
  const byGrade = GRADES.map((grade) => ({
    grade,
    terms: terms.filter((term) => term.grade === grade),
  })).filter((group) => group.terms.length > 0);

  return (
    <>
      <PageHeader
        title="المحتوى"
        subtitle="الترم يحتوي على محاضرات، والمحاضرة هي الوحدة التي يشتريها الطالب."
        action={
          <a
            href={includeArchived ? '/admin/content' : '/admin/content?archived=1'}
            className="text-sm text-brand hover:underline"
          >
            {includeArchived ? 'إخفاء المؤرشف' : 'عرض المؤرشف'}
          </a>
        }
      />

      <CreateTerm />

      {byGrade.length === 0 ? (
        <EmptyState>لا توجد ترمات بعد. أنشئ ترماً لتبدأ.</EmptyState>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {byGrade.map((group) => (
            <section key={group.grade}>
              <h2 className="mb-3 text-base font-semibold">
                {GRADE_LABELS_AR[group.grade as Grade]}
              </h2>
              <div className="flex flex-col gap-4">
                {group.terms.map((term) => (
                  <TermSection
                    key={term._id}
                    term={term}
                    lectures={lectures.filter(
                      (lecture) =>
                        (typeof lecture.term === 'string'
                          ? lecture.term
                          : lecture.term?._id) === term._id,
                    )}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
