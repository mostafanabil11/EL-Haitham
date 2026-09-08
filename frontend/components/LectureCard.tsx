import Link from 'next/link';
import type { CatalogLecture } from '@/lib/types';
import { GRADE_LABELS_AR } from '@/lib/grades';
import { formatPrice, formatDuration } from '@/lib/format';

export function LectureCard({ lecture }: { lecture: CatalogLecture }) {
  return (
    <Link
      href={`/lectures/${lecture.slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-border p-4 transition hover:border-brand/60"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-border/40 px-2.5 py-1 text-xs text-muted">
          {GRADE_LABELS_AR[lecture.grade]}
        </span>
        <span className="shrink-0 font-bold text-brand">{formatPrice(lecture.priceMinorUnits)}</span>
      </div>

      <h3 className="text-base font-semibold leading-snug transition group-hover:text-brand">
        {lecture.titleAr}
      </h3>

      {lecture.description && (
        <p className="line-clamp-2 text-sm text-muted">{lecture.description}</p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted">
        <span>{lecture.itemCount} درس</span>
        <span aria-hidden>·</span>
        <span>{formatDuration(lecture.totalDurationSeconds)}</span>
      </div>
    </Link>
  );
}
