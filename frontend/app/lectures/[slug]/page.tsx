import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLecture, getPublicSettings, getCurrentUser } from '@/lib/server-api';
import { GRADE_LABELS_AR } from '@/lib/grades';
import { formatPrice, formatDuration, buildWhatsAppLink } from '@/lib/format';
import { BuyButton } from './BuyButton';
import { CurriculumList } from './CurriculumList';
import { LectureCodes } from '@/app/admin/content/lectures/[id]/LectureCodes';
import { getAccessCodes } from '@/lib/admin-api';
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

  // The teacher reads this page as a student would whenever someone messages
  // him about a lecture, and that is exactly the moment he needs to cut a
  // code. Fetched only for him — a student never pays for this query, and the
  // admin API would refuse them anyway.
  const isAdmin = user?.role === 'admin';
  const codeCount = isAdmin
    ? (await getAccessCodes({ lectureId: lecture._id, status: 'unused', limit: 1 })).pagination.total
    : 0;

  const price = formatPrice(lecture.priceMinorUnits);
  const whatsappLink = buildWhatsAppLink(settings?.whatsappNumber ?? null, lecture.titleAr, price);
  const freeCount = lecture.items.filter((i) => i.isFreePreview).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-5 py-12 sm:py-16">
      <Link href="/lectures" className="text-sm text-muted transition hover:text-foreground">
        &#8594; كل المحاضرات
      </Link>

      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-border/40 px-2.5 py-1">
            {GRADE_LABELS_AR[lecture.grade]}
          </span>
          {lecture.term && <span className="rounded-full bg-border/40 px-2.5 py-1">{lecture.term.titleAr}</span>}
        </div>

        <h1 className="text-3xl font-semibold leading-relaxed">{lecture.titleAr}</h1>

        {lecture.description && <p className="text-muted">{lecture.description}</p>}

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{lecture.itemCount} درس</span>
          <span aria-hidden>·</span>
          <span>{formatDuration(lecture.totalDurationSeconds)}</span>
          {freeCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="text-link">{freeCount} درس مجاني</span>
            </>
          )}
        </div>
      </header>

      {owned ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <p className="font-semibold text-link">أنت مشترك في هذه المحاضرة</p>
          <Link
            href={`/learn/${lecture.slug}`}
            className="rounded-lg bg-brand px-4 py-3 text-center text-base font-semibold text-brand-contrast transition hover:opacity-90"
          >
            ابدأ المشاهدة
          </Link>
        </section>
      ) : (
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">سعر المحاضرة</span>
          <span className="text-2xl font-bold text-accent">{price}</span>
        </div>

        <BuyButton
          lectureId={lecture._id}
          slug={lecture.slug}
          isSignedIn={!!user}
          fallbackWhatsAppUrl={whatsappLink}
        />

        <p className="text-xs text-muted">
          بعد الدفع ستستلم كوداً تفعّله من{' '}
          <Link href="/redeem" className="text-link hover:underline">
            صفحة تفعيل الكود
          </Link>
          .
        </p>
      </section>
      )}

      {isAdmin && (
        // Marked as a teacher tool and dashed, so it never reads as part of
        // what a student sees on the same page.
        <section className="rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-1">
          <p className="px-5 pt-4 text-xs font-semibold text-accent">أدوات المدرس — لا يراها الطلاب</p>
          <LectureCodes
            lectureId={lecture._id}
            lectureTitle={lecture.titleAr}
            priceMinorUnits={lecture.priceMinorUnits}
            unusedCount={codeCount}
          />
        </section>
      )}

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">محتوى المحاضرة</h2>

        {/* The curriculum is public. A visitor sees exactly what they would be
            buying — titles, durations, which parts are free — while the
            content itself stays behind the enrollment check. The incumbent
            shows none of this without an account. */}
        <CurriculumList items={lecture.items} slug={lecture.slug} isSignedIn={!!user} />
      </section>
    </main>
  );
}
