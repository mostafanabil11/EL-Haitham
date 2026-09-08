'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'نظرة عامة' },
  { href: '/admin/requests', label: 'الطلبات' },
  { href: '/admin/codes', label: 'الأكواد' },
  { href: '/admin/students', label: 'الطلاب' },
  { href: '/admin/content', label: 'المحتوى' },
  { href: '/admin/settings', label: 'الإعدادات' },
];

/**
 * The admin tab row only.
 *
 * The site name, the theme control and the account button all live in
 * SiteHeader now, one bar up — repeating any of them here would give the admin
 * area two headers arguing about which is the real one.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border">
      {/* Scrolls horizontally rather than wrapping: the teacher works from a
          phone as often as a laptop, and a wrapped nav pushes the content of
          every page below the fold on a 375px screen. */}
      <nav className="mx-auto -mb-px flex w-full max-w-6xl gap-1 overflow-x-auto px-5 py-2">
        {LINKS.map((link) => {
          const active =
            link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                active
                  ? 'bg-brand text-brand-contrast font-semibold'
                  : 'text-muted hover:bg-border/50 hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
