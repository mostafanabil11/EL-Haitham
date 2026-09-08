import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLearnLecture } from '@/lib/server-api';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { LearnClient } from './LearnClient';

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: 'مشاهدة',
  // The watch page is per-student and behind a paywall; there is nothing here
  // for a crawler, and indexing it would only surface locked pages in search.
  robots: { index: false, follow: false },
};

export default async function LearnPage({ params }: Props) {
  const { slug } = await params;
  const lecture = await getLearnLecture(slug);

  if (!lecture) notFound();

  return (
    <main className="page-shell flex flex-1 flex-col gap-10 py-12">
      <div className="flex flex-col gap-4">
        <Link
          href={`/lectures/${slug}`}
          className="text-sm text-muted transition hover:text-foreground"
        >
          &#8594; صفحة المحاضرة
        </Link>
        <h1 className="text-2xl font-bold">{lecture.titleAr}</h1>
        <p className="text-xs text-muted">{GRADE_LABELS_AR[lecture.grade as Grade]}</p>
      </div>

      <LearnClient items={lecture.items} hasAccess={lecture.hasAccess} lectureSlug={slug} />
    </main>
  );
}
