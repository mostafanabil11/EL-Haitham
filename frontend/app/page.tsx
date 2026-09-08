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

      <section className="mx-auto w-full max-w-5xl px-5 py-14">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="text-xl font-bold">أحدث المحاضرات</h2>
          {total > 0 && (
            <Link href="/lectures" className="text-sm text-link hover:underline">
              عرض الكل ({total})
            </Link>
          )}
        </div>

        {/* Grade first, because a student only ever wants one of the four and
            scrolling past three years of someone else's syllabus is exactly
            what makes the incumbent's flat list of 117 unusable. */}
        <nav aria-label="الصفوف الدراسية" className="mb-6 flex flex-wrap gap-2">
          {GRADES.map((grade) => (
            <Link
              key={grade}
              href={`/lectures?grade=${grade}`}
              className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted transition hover:border-brand/40 hover:text-foreground"
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lectures.map((lecture) => (
              <LectureCard key={lecture._id} lecture={lecture} />
            ))}
          </div>
        )}
      </section>

      <HowItWorks whatsappNumber={settings?.whatsappNumber ?? null} />

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted">
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
    <section className="mx-auto w-full max-w-5xl px-5 pt-8">
      {/*
        A navy panel rather than a tinted page section. In this design system
        navy is the institution speaking — it frames the one thing the visitor
        is meant to do — and the single action sitting on it is gold, which is
        how every call to action on a dark surface reads in the mockups.

        It also stays navy in both themes: it is a deliberate surface, not a
        consequence of the current palette.
      */}
      <div className="relative overflow-hidden rounded-3xl bg-panel px-6 py-12 sm:px-10 sm:py-16">
        {/* A soft gold bloom in the upper corner, which in RTL is the side the
            eye starts from. Purely atmospheric, and cheap — no image to load. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -start-24 size-72 rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative">
          {settings?.teacherName && (
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              مع {settings.teacherName}
            </p>
          )}

          <h1 className="max-w-3xl text-3xl font-bold leading-[1.25] text-panel-foreground sm:text-[40px]">
            {settings?.siteName ?? 'منصة اللغة العربية'}
          </h1>

          {settings?.tagline && (
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-panel-muted">
              {settings.tagline}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/lectures"
              className="rounded-xl bg-accent px-5 py-3 text-base font-semibold text-accent-contrast transition hover:opacity-90"
            >
              تصفح المحاضرات
            </Link>
            {/* Someone already signed in has an account; offering them one
                again is the kind of dead button that makes a site feel
                untended. They get the code entry instead, which is what they
                come back for. */}
            <Link
              href={signedIn ? '/redeem' : '/register'}
              className="rounded-xl border border-panel-foreground/25 px-5 py-3 text-base font-medium text-panel-foreground transition hover:border-panel-foreground/50"
            >
              {signedIn ? 'تفعيل كود' : 'إنشاء حساب'}
            </Link>
          </div>

          {total > 0 && (
            <p className="mt-6 text-sm text-panel-muted">
              {total} محاضرة متاحة الآن · شاهد أول درس من كل محاضرة مجاناً
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
    <section className="border-t border-border bg-trough">
      <div className="mx-auto w-full max-w-5xl px-5 py-12">
        <h2 className="mb-6 text-xl font-bold">كيف تشترك؟</h2>

        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-card p-5">
              <span
                aria-hidden
                className="mb-3 inline-flex size-9 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent"
              >
                {index + 1}
              </span>
              <h3 className="mb-1.5 text-base font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:border-brand/40"
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
