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
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-5">
        <Link href="/" className="truncate text-base font-bold transition hover:text-brand">
          {siteName}
        </Link>

        <nav className="ms-auto flex items-center gap-1 text-sm">
          <Link
            href="/lectures"
            className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-border/40 hover:text-foreground"
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
              className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-border/40 hover:text-foreground"
            >
              تفعيل كود
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
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
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border
          text-muted transition hover:border-brand/60 hover:text-foreground"
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
      className="inline-flex size-8 items-center justify-center rounded-lg bg-brand text-sm
        font-bold text-brand-contrast transition hover:opacity-90"
    >
      {[...name.trim()][0] ?? '؟'}
    </Link>
  );
}
