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

      <section className="mx-auto w-full max-w-5xl px-5 py-12">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="text-xl font-bold">أحدث المحاضرات</h2>
          {total > 0 && (
            <Link href="/lectures" className="text-sm text-brand hover:underline">
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
              className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted transition hover:border-brand/60 hover:text-foreground"
            >
              {GRADE_LABELS_AR[grade]}
            </Link>
          ))}
        </nav>

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
                className="text-brand hover:underline"
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
    <section className="border-b border-border">
      {/*
        A soft brand wash behind the hero rather than a photo. There is no
        photography to rely on — the teacher supplies none — and a tinted
        gradient reads as designed in both palettes, where a placeholder image
        reads as unfinished in either.
      */}
      <div className="bg-gradient-to-b from-brand/10 to-transparent">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
          {settings?.teacherName && (
            <p className="mb-3 inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              مع {settings.teacherName}
            </p>
          )}

          <h1 className="max-w-3xl text-4xl font-bold leading-[1.15] sm:text-5xl">
            {settings?.siteName ?? 'منصة اللغة العربية'}
          </h1>

          {settings?.tagline && (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{settings.tagline}</p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/lectures"
              className="rounded-lg bg-brand px-5 py-3 text-base font-semibold text-brand-contrast transition hover:opacity-90"
            >
              تصفح المحاضرات
            </Link>
            {/* Someone already signed in has an account; offering them one
                again is the kind of dead button that makes a site feel
                untended. They get the code entry instead, which is what they
                come back for. */}
            {signedIn ? (
              <Link
                href="/redeem"
                className="rounded-lg border border-border px-5 py-3 text-base font-medium transition hover:border-brand/60"
              >
                تفعيل كود
              </Link>
            ) : (
              <Link
                href="/register"
                className="rounded-lg border border-border px-5 py-3 text-base font-medium transition hover:border-brand/60"
              >
                إنشاء حساب
              </Link>
            )}
          </div>

          {total > 0 && (
            <p className="mt-6 text-sm text-muted">
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
    <section className="border-t border-border bg-border/15">
      <div className="mx-auto w-full max-w-5xl px-5 py-12">
        <h2 className="mb-6 text-xl font-bold">كيف تشترك؟</h2>

        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-border bg-background p-5">
              <span
                aria-hidden
                className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand"
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
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:border-brand/60"
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
