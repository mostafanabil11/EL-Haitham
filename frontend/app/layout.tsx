import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

// IBM Plex Sans Arabic, per the design system: a deliberate, modern face that
// balances mechanical precision with Kufic structure, and avoids the informal
// roundness that makes an exam-prep platform read as a children's app. Without
// an explicit Arabic face the browser falls back to whatever it has, which on
// Windows is Tahoma.
//
// Weights are named rather than left to default: variable Arabic subsets are
// not published for this family, so an unlisted weight silently renders as a
// synthesised bold.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "منصة اللغة العربية",
    template: "%s | منصة اللغة العربية",
  },
  description: "محاضرات اللغة العربية للمرحلتين الإعدادية والثانوية.",
  // Every share goes through WhatsApp, so the link preview is the single most
  // valuable piece of metadata on this site. The incumbent renders nothing on
  // the server, so its links unfurl blank.
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: "منصة اللغة العربية",
  },
};

/*
 * Runs before the first paint, ahead of React.
 *
 * The saved choice lives in localStorage, which a server render cannot see —
 * so without this the page would paint in the OS palette and then snap to the
 * chosen one on hydration. That flash is brief and genuinely unpleasant, and
 * it is the whole reason this is a blocking inline script rather than an
 * effect. Only 'light' and 'dark' are ever stored; "follow the system" is
 * represented by the absence of a value, so the CSS media query stays in
 * charge and keeps tracking the OS.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `-u-nu-latn` forces Latin digits (1, 2, 3) rather than Arabic-Indic
    // (١, ٢, ٣) while keeping the page Arabic. Prices, durations and access
    // codes are all misread and mistyped in Arabic-Indic numerals, and codes
    // get dictated over WhatsApp. The incumbent sets the same locale, and it
    // is the right call.
    //
    // suppressHydrationWarning because the script above deliberately mutates
    // <html> before React sees it; without this, React reports the attribute
    // it did not render as a mismatch.
    <html
      lang="ar-EG-u-nu-latn"
      dir="rtl"
      className={`${plexArabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/*
        Also suppressed on <body>, for a different reason than <html>: browser
        extensions inject attributes here before React hydrates (ColorZilla's
        `cz-shortcut-listen`, password managers, translation tools). React
        reports each one as a mismatch, which fills the console with warnings
        nobody can act on and buries real ones.
      */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
