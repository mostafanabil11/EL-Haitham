import Link from 'next/link';
import { getPublicSettings, getCatalog, getCurrentUser } from '@/lib/server-api';
import { LectureCard } from '@/components/LectureCard';
import { GRADES, GRADE_LABELS_AR } from '@/lib/grades';

// Everything here is fetched and rendered on the server, so the lecture
// titles and prices are in the HTML that Google and WhatsApp receive. The
// incumbent ships "جارٍ تحميل المحتوى..." to both.
export default async function Home() {
  const [settings, { lectures, total }, user] = await Promise.all([
    getPublicSettings(),
    getCatalog({ limit: 6 }),
    getCurrentUser(),
  ]);

  return (
    <main className="flex w-full flex-1 flex-col">
      <Hero settings={settings} total={total} signedIn={!!user} />

      <section className="page-shell page-section">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold">أحدث المحاضرات</h2>
          {total > 0 && (
            <Link href="/lectures" className="text-sm text-link hover:underline">
              عرض الكل ({total})
            </Link>
          )}
        </div>

        {/* Grade first, because a student only ever wants one of the four and
            scrolling past three years of someone else's syllabus is exactly
            what makes the incumbent's flat list of 117 unusable. */}
        <nav aria-label="الصفوف الدراسية" className="mb-8 flex flex-wrap gap-2 border-b border-border pb-5">
          {GRADES.map((grade) => (
            <Link
              key={grade}
              href={`/lectures?grade=${grade}`}
              className="filter-link"
            >
              {GRADE_LABELS_AR[grade]}
            </Link>
          ))}
        </nav>

        {lectures.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            لا توجد محاضرات منشورة بعد.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {lectures.map((lecture) => (
              <LectureCard key={lecture._id} lecture={lecture} />
            ))}
          </div>
        )}
      </section>

      <HowItWorks whatsappNumber={settings?.whatsappNumber ?? null} />

      <footer className="mt-auto border-t border-border">
        <div className="page-shell flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted">
          <p>{settings?.siteName ?? 'منصة اللغة العربية'}</p>
          {settings?.whatsappNumber && (
            <p>
              للاستفسار:{' '}
              <a
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="text-link hover:underline"
              >
                {toLocalPhone(settings.whatsappNumber)}
              </a>
            </p>
          )}
        </div>
      </footer>
    </main>
  );
}

function Hero({
  settings,
  total,
  signedIn,
}: {
  settings: Awaited<ReturnType<typeof getPublicSettings>>;
  total: number;
  signedIn: boolean;
}) {
  return (
    <section className="page-shell pt-8 sm:pt-12">
      <div className="rounded-2xl bg-panel px-6 py-12 sm:px-12 sm:py-16">
        <div className="max-w-2xl">
          {settings?.teacherName && (
            <p className="mb-5 text-sm font-medium text-accent">
              مع {settings.teacherName}
            </p>
          )}

          <h1 className="text-3xl font-semibold leading-[1.5] text-panel-foreground sm:text-[42px]">
            {settings?.siteName ?? 'منصة اللغة العربية'}
          </h1>

          {settings?.tagline && (
            <p className="mt-5 max-w-xl text-base leading-loose text-panel-muted sm:text-lg">
              {settings.tagline}
            </p>
          )}

          <div className="mt-9 flex flex-wrap items-center gap-3 sm:gap-5">
            <Link
              href="/lectures"
              className="inline-flex min-h-12 items-center gap-4 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-contrast transition hover:opacity-90"
            >
              تصفح المحاضرات
              <span aria-hidden>←</span>
            </Link>
            {/* Someone already signed in has an account; offering them one
                again is the kind of dead button that makes a site feel
                untended. They get the code entry instead, which is what they
                come back for. */}
            <Link
              href={signedIn ? '/redeem' : '/register'}
              className="rounded-xl px-4 py-3 text-sm font-medium text-panel-foreground transition hover:bg-foreground/5"
            >
              {signedIn ? 'تفعيل كود' : 'إنشاء حساب'}
            </Link>
          </div>

          {total > 0 && (
            <p className="mt-8 text-sm text-panel-muted">
              {total} محاضرة متاحة الآن
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The part the incumbent never explains, and the reason its support load is
 * what it is: payment happens on WhatsApp, so a student arriving cold has no
 * idea what is about to be asked of them. Saying it in three steps up front is
 * cheaper than answering it one message at a time.
 */
function HowItWorks({ whatsappNumber }: { whatsappNumber: string | null }) {
  const steps = [
    {
      title: 'اختر المحاضرة',
      body: 'تصفح المحاضرات حسب صفك الدراسي، واطّلع على محتواها قبل الشراء.',
    },
    {
      title: 'ادفع عبر واتساب',
      body: 'اضغط «اشترك الآن» فتصلنا رسالة برقم طلبك، ونرسل لك كود التفعيل بعد الدفع.',
    },
    {
      title: 'فعّل وابدأ',
      body: 'أدخل الكود مرة واحدة من صفحة «تفعيل كود»، وتُفتح المحاضرة في حسابك.',
    },
  ];

  return (
    <section className="border-t border-border">
      <div className="page-shell page-section">
        <h2 className="mb-10 text-2xl font-semibold">كيف تشترك؟</h2>

        <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {steps.map((step, index) => (
            <li key={step.title} className="max-w-sm">
              <span
                aria-hidden
                className="mb-5 inline-flex size-10 items-center justify-center rounded-xl bg-trough text-sm font-medium text-link"
              >
                {index + 1}
              </span>
              <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm leading-loose text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center py-2 text-sm font-medium text-link hover:underline"
          >
            تواصل معنا على واتساب
          </a>
        )}
      </div>
    </section>
  );
}

// Stored canonically as 201XXXXXXXXX; read and dialled as 01XXXXXXXXX.
function toLocalPhone(phone: string): string {
  return phone.startsWith('20') ? `0${phone.slice(2)}` : phone;
}
