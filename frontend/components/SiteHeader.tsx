import Link from 'next/link';
import { getCurrentUser, getPublicSettings } from '@/lib/server-api';
import { ThemeToggle } from './ThemeToggle';

/**
 * The bar every page hangs under.
 *
 * Rendered on the server, so the signed-in state is correct in the very first
 * HTML — no avatar popping in after hydration, and no flash of a "sign in"
 * link at someone who is already signed in.
 */
export async function SiteHeader() {
  const [settings, user] = await Promise.all([getPublicSettings(), getCurrentUser()]);

  const siteName = settings?.siteName ?? 'منصة اللغة العربية';
  // The teacher's own account lands in the admin area; a student lands on
  // their lectures. One icon, two destinations, no extra menu to open.
  const accountHref = user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/login';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="page-shell flex min-h-20 flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:gap-x-6">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-lg font-semibold text-brand-contrast shadow-sm"
          >
            {[...siteName.trim()][0] ?? 'م'}
          </span>
          <span className="truncate text-sm font-semibold transition hover:text-link sm:text-base">
            {siteName}
          </span>
        </Link>

        <nav aria-label="التنقل الرئيسي" className="order-last flex w-full items-center justify-center gap-2 border-t border-border pt-2 text-sm sm:order-none sm:ms-auto sm:w-auto sm:border-0 sm:pt-0">
          <Link
            href="/lectures"
            className="rounded-lg px-4 py-2.5 text-muted transition hover:bg-trough hover:text-foreground"
          >
            المحاضرات
          </Link>
          {/* Only shown to someone who can actually use it. A student seeing
              "تفعيل كود" before they have one is noise; after they buy, it is
              the single most important link on the site — so it appears the
              moment they have an account. */}
          {user && user.role !== 'admin' && (
            <Link
              href="/redeem"
              className="rounded-lg px-4 py-2.5 text-muted transition hover:bg-trough hover:text-foreground"
            >
              تفعيل كود
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <AccountButton href={accountHref} name={user?.name ?? null} />
        </div>
      </div>
    </header>
  );
}

function AccountButton({ href, name }: { href: string; name: string | null }) {
  if (!name) {
    return (
      <Link
        href={href}
        aria-label="تسجيل الدخول"
        title="تسجيل الدخول"
        className="inline-flex size-11 items-center justify-center rounded-xl
          text-muted transition hover:bg-trough hover:text-foreground"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </Link>
    );
  }

  // An initial rather than a generic silhouette: it confirms *which* account is
  // signed in, which matters on a shared family phone — the case this platform
  // actually has, where a parent and a student use the same device.
  return (
    <Link
      href={href}
      aria-label={`حسابي — ${name}`}
      title={name}
      className="inline-flex size-11 items-center justify-center rounded-xl bg-trough text-sm
        font-semibold text-link transition hover:opacity-90"
    >
      {[...name.trim()][0] ?? '؟'}
    </Link>
  );
}
