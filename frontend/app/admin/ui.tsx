import Link from 'next/link';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  emphasis,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  // Used for the pending queue only. It is the one number on this page that
  // represents someone waiting on a reply, so it earns the colour.
  emphasis?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${emphasis ? 'text-brand' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );

  const className = `rounded-xl border p-4 ${
    emphasis ? 'border-brand/50 bg-brand/5' : 'border-border'
  } ${href ? 'transition hover:border-brand/60' : ''}`;

  return href ? (
    <Link href={href} className={`block ${className}`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

const PILL_STYLES: Record<string, string> = {
  neutral: 'border-border text-muted',
  positive: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'border-red-500/40 bg-red-500/10 text-red-500',
};

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: keyof typeof PILL_STYLES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs ${PILL_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

/**
 * Tables are the wrong shape on a 375px screen, so every list in this area is
 * a card list that gains table-like columns from `sm:` upwards. Wrapping the
 * scroll here means no admin page can accidentally scroll the whole document
 * sideways.
 */
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border p-4">{children}</div>;
}

export function Pagination({
  page,
  pages,
  basePath,
  params = {},
}: {
  page: number;
  pages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;

  const build = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    query.set('page', String(target));
    return `${basePath}?${query}`;
  };

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link href={build(page - 1)} className="rounded-lg border border-border px-3 py-1.5 hover:border-brand/60">
          السابق
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-muted">
        صفحة {page} من {pages}
      </span>
      {page < pages ? (
        <Link href={build(page + 1)} className="rounded-lg border border-border px-3 py-1.5 hover:border-brand/60">
          التالي
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

export function formatDateTimeAr(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateAr(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "منذ ٣ ساعات" — how long a student has been waiting, which is the only
 *  reading of a pending request's timestamp the teacher actually needs. */
export function relativeAr(value: string | Date): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return `منذ ${days} يوم`;
}
