import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLecture, getPublicSettings, getCurrentUser } from '@/lib/server-api';
import { GRADE_LABELS_AR } from '@/lib/grades';
import { formatPrice, formatDuration, buildWhatsAppLink } from '@/lib/format';
import { BuyButton } from './BuyButton';
import { getMyEnrollments } from '@/lib/server-api';

type Props = { params: Promise<{ slug: string }> };

// This is the function that beats the incumbent on its own distribution
// channel. Every share happens in WhatsApp, and WhatsApp reads these tags off
// the server-rendered HTML. The incumbent renders nothing on the server, so
// its links unfurl blank — a shared lecture is an unlabelled URL.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [lecture, settings] = await Promise.all([getLecture(slug), getPublicSettings()]);

  if (!lecture) return { title: 'المحاضرة غير موجودة' };

  const price = formatPrice(lecture.priceMinorUnits);
  const description =
    lecture.description ??
    `${GRADE_LABELS_AR[lecture.grade]} · ${lecture.itemCount} درس · ${formatDuration(lecture.totalDurationSeconds)} · ${price}`;

  return {
    title: lecture.titleAr,
    description,
    openGraph: {
      title: `${lecture.titleAr} — ${price}`,
      description,
      type: 'article',
      locale: 'ar_EG',
      siteName: settings?.siteName ?? 'منصة اللغة العربية',
      ...(lecture.coverImage ? { images: [{ url: lecture.coverImage }] } : {}),
    },
    twitter: {
      card: lecture.coverImage ? 'summary_large_image' : 'summary',
      title: `${lecture.titleAr} — ${price}`,
      description,
    },
    alternates: { canonical: `/lectures/${lecture.slug}` },
  };
}

export default async function LecturePage({ params }: Props) {
  const { slug } = await params;
  const [lecture, settings, user] = await Promise.all([
    getLecture(slug),
    getPublicSettings(),
    getCurrentUser(),
  ]);

  if (!lecture) notFound();

  // Checked server-side so someone who already owns the lecture never sees a
  // buy button for something they have paid for.
  const enrollments = user ? await getMyEnrollments() : [];
  const owned = enrollments.some((e) => e.lecture?.slug === lecture.slug);

  const price = formatPrice(lecture.priceMinorUnits);
  const whatsappLink = buildWhatsAppLink(settings?.whatsappNumber ?? null, lecture.titleAr, price);
  const freeCount = lecture.items.filter((i) => i.isFreePreview).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
      <Link href="/lectures" className="text-sm text-muted transition hover:text-foreground">
        &#8594; كل المحاضرات
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-border/40 px-2.5 py-1">
            {GRADE_LABELS_AR[lecture.grade]}
          </span>
          {lecture.term && <span className="rounded-full bg-border/40 px-2.5 py-1">{lecture.term.titleAr}</span>}
        </div>

        <h1 className="text-3xl font-bold leading-tight">{lecture.titleAr}</h1>

        {lecture.description && <p className="text-muted">{lecture.description}</p>}

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{lecture.itemCount} درس</span>
          <span aria-hidden>·</span>
          <span>{formatDuration(lecture.totalDurationSeconds)}</span>
          {freeCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="text-brand">{freeCount} درس مجاني</span>
            </>
          )}
        </div>
      </header>

      {owned ? (
        <section className="flex flex-col gap-2 rounded-xl border border-brand/40 bg-brand/5 p-5">
          <p className="font-semibold text-brand">أنت مشترك في هذه المحاضرة</p>
          <Link
            href={`/learn/${lecture.slug}`}
            className="rounded-lg bg-brand px-4 py-3 text-center text-base font-semibold text-brand-contrast transition hover:opacity-90"
          >
            ابدأ المشاهدة
          </Link>
        </section>
      ) : (
      <section className="flex flex-col gap-3 rounded-xl border border-brand/40 bg-brand/5 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">سعر المحاضرة</span>
          <span className="text-2xl font-bold text-brand">{price}</span>
        </div>

        <BuyButton
          lectureId={lecture._id}
          slug={lecture.slug}
          isSignedIn={!!user}
          fallbackWhatsAppUrl={whatsappLink}
        />

        <p className="text-xs text-muted">
          بعد الدفع ستستلم كوداً تفعّله من{' '}
          <Link href="/redeem" className="text-brand hover:underline">
            صفحة تفعيل الكود
          </Link>
          .
        </p>
      </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">محتوى المحاضرة</h2>

        {/* The curriculum is public. A visitor sees exactly what they would be
            buying — titles, durations, which parts are free — while the
            content itself stays behind the enrollment check. The incumbent
            shows none of this without an account. */}
        <ol className="flex flex-col gap-2">
          {lecture.items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
            >
              <span className="w-6 shrink-0 text-sm text-muted">{index + 1}</span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.titleAr}</p>
                <p className="text-xs text-muted">
                  {item.type === 'video' ? 'فيديو' : item.type === 'pdf' ? 'ملف' : item.type === 'text' ? 'نص' : 'بث مباشر'}
                  {item.videoDurationSeconds > 0 && ` · ${formatDuration(item.videoDurationSeconds)}`}
                </p>
              </div>

              {item.isFreePreview ? (
                <Link
                  href={`/learn/${lecture.slug}`}
                  className="shrink-0 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand/25"
                >
                  شاهد مجاناً
                </Link>
              ) : (
                <span className="shrink-0 text-xs text-muted" title="يتطلب اشتراك">
                  مقفل
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
