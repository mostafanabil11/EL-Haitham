import Link from 'next/link';
import type { CatalogLecture } from '@/lib/types';
import { GRADE_LABELS_AR } from '@/lib/grades';
import { formatPrice, formatDuration } from '@/lib/format';

export function LectureCard({ lecture }: { lecture: CatalogLecture }) {
  return (
    <Link
      href={`/lectures/${lecture.slug}`}
      className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6 sm:p-8
        transition-colors hover:border-border-strong"
    >
      <div className="mb-5 text-sm text-muted">
        <span>
          {GRADE_LABELS_AR[lecture.grade]}
        </span>
      </div>

      <h3 className="text-xl font-semibold leading-relaxed transition-colors group-hover:text-link">
        {lecture.titleAr}
      </h3>

      {lecture.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-loose text-muted">{lecture.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-8">
        <span className="flex items-center gap-2 text-sm text-muted">
          <span>{lecture.itemCount} درس</span>
          <span aria-hidden>·</span>
          <span>{formatDuration(lecture.totalDurationSeconds)}</span>
        </span>
        <span className="text-base font-semibold text-accent">{formatPrice(lecture.priceMinorUnits)}</span>
      </div>
    </Link>
  );
}
