import Link from 'next/link';
import type { CatalogLecture } from '@/lib/types';
import { GRADE_LABELS_AR } from '@/lib/grades';
import { formatPrice, formatDuration } from '@/lib/format';

export function LectureCard({ lecture }: { lecture: CatalogLecture }) {
  return (
    <Link
      href={`/lectures/${lecture.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5
        transition hover:border-brand/40 hover:shadow-[0_8px_24px_-12px_rgba(22,32,59,0.25)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-trough px-2.5 py-1 text-xs font-medium text-muted">
          {GRADE_LABELS_AR[lecture.grade]}
        </span>
        {/* Gold carries value in this system — price, progress, achievement —
            while navy carries structure. */}
        <span className="shrink-0 font-bold text-accent">
          {formatPrice(lecture.priceMinorUnits)}
        </span>
      </div>

      <h3 className="text-[17px] font-semibold leading-snug transition group-hover:text-link">
        {lecture.titleAr}
      </h3>

      {lecture.description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">{lecture.description}</p>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
        <span>{lecture.itemCount} درس</span>
        <span aria-hidden>·</span>
        <span>{formatDuration(lecture.totalDurationSeconds)}</span>
      </div>
    </Link>
  );
}
