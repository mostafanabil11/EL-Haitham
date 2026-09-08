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

export function AdminNav({ teacherName }: { teacherName: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold">لوحة التحكم</span>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="hidden sm:inline">{teacherName}</span>
            <Link href="/" className="hover:text-brand">
              الموقع
            </Link>
          </div>
        </div>

        {/* Scrolls horizontally rather than wrapping: the teacher works from a
            phone as often as a laptop, and a wrapped nav pushes the content of
            every page below the fold on a 375px screen. */}
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
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
    </header>
  );
}
