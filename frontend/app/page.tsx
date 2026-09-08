import Link from 'next/link';
import { getPublicSettings, getCatalog } from '@/lib/server-api';
import { LectureCard } from '@/components/LectureCard';
import { GRADES, GRADE_LABELS_AR } from '@/lib/grades';

// Everything here is fetched and rendered on the server, so the lecture
// titles and prices are in the HTML that Google and WhatsApp receive. The
// incumbent ships "جارٍ تحميل المحتوى..." to both.
export default async function Home() {
  const [settings, { lectures, total }] = await Promise.all([
    getPublicSettings(),
    getCatalog({ limit: 6 }),
  ]);

  return (
    <main className="flex w-full flex-1 flex-col">
      <section className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-14">
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            {settings?.siteName ?? 'منصة اللغة العربية'}
          </h1>

          {settings?.tagline && <p className="max-w-2xl text-lg text-muted">{settings.tagline}</p>}

          {settings?.teacherName && (
            <p className="text-sm text-muted">مع {settings.teacherName}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/lectures"
              className="rounded-lg bg-brand px-5 py-3 text-base font-semibold text-brand-contrast transition hover:opacity-90"
            >
              تصفح المحاضرات
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-border px-5 py-3 text-base font-medium transition hover:border-brand/60"
            >
              إنشاء حساب
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 py-12">
        <nav aria-label="الصفوف الدراسية" className="mb-8 flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <Link
              key={g}
              href={`/lectures?grade=${g}`}
              className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted transition hover:border-brand/60 hover:text-foreground"
            >
              {GRADE_LABELS_AR[g]}
            </Link>
          ))}
        </nav>

        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold">أحدث المحاضرات</h2>
          {total > 0 && (
            <Link href="/lectures" className="text-sm text-brand hover:underline">
              عرض الكل ({total})
            </Link>
          )}
        </div>

        {lectures.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
            لا توجد محاضرات منشورة بعد.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lectures.map((lecture) => (
              <LectureCard key={lecture._id} lecture={lecture} />
            ))}
          </div>
        )}
      </section>

      {settings?.whatsappNumber && (
        <footer className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-5 py-8 text-sm text-muted">
            للاستفسار:{' '}
            <a
              href={`https://wa.me/${settings.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="text-brand hover:underline"
            >
              {settings.whatsappNumber}
            </a>
          </div>
        </footer>
      )}
    </main>
  );
}
