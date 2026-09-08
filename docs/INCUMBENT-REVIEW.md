# Review of the current platform — haitham-sadeq.lms-r.com

Reviewed 2026-09-07. Everything below comes from the public site and the API endpoints the page
itself calls unauthenticated. No account was created and nothing was bypassed.

---

## What it actually is

Not a custom build. It is **Remotily** (`remotily.ai`), a white-label multi-tenant LMS rented per
teacher — `lms-r.com` is the vendor's domain, the teacher gets a subdomain. Version **1.7.9**.
Next.js App Router with `/api/*` route handlers, MongoDB, files on the app server's local disk.

The teacher is **renting a generic product**, not owning a platform. That is the single most
important fact, and it explains almost every problem below.

### Evidence of the rental, visible from outside

- `subscriptionRenewalDate: 2026-09-22`, `currentSubscriptionPackage: "Old customers"`,
  `activeStudentPricePerStudent: 2` — he is billed **per active student**. Growth costs him money.
- The teacher-bio section still contains **another teacher's data**: `name: "أ/ محمد سند"`,
  bio *"مدرس اول لغة عربية في مدينة مدينة الفلكة"* (note the duplicated word "مدينة"). Left over from a
  template or another tenant. It is switched off, so nobody sees it — but it is sitting in his record.
- Homepage slides 2 and 3 are the vendor's demo content — *"شهادات معتمدة"*, stock screenshots
  (`/images/mobile-screenshot.jpg`) — pointing at a `/certificates` page.
- 13 configurable homepage sections exist; **only 2 are switched on** (slider, courses). Features,
  reviews, teachers, stats, FAQ, contact, CTA, search, mobile app — all off.

---

## The real numbers (from `/api/courses`, which is public)

| | |
|---|---|
| Total courses | **117** |
| Active | **10** — 107 are archived last-year content |
| By grade | ثالث ثانوي 47 · ثاني ثانوي 34 · اول ثانوي 33 · ثالث اعدادي 3 |
| Price range | **40–100 EGP** (mostly 65–75) |
| Total subscriptions, all time | **296** since 2025-09-22 |
| Best-selling single item | **143** subscribers |
| Courses with a quiz | **0** |
| Courses with homework | **0** |
| Courses with files | **8** |
| Courses with a description | 63 of 117 |

### What these numbers mean for our build

**1. He does not sell courses. He sells individual lectures.**
Most items have `lessonsCount: 1` and are literally named *المحاضرة ٢*, *المحاضرة ٣*, *محاضرة ١٢*.
The buyable unit is one lecture at 40–100 EGP. Our data model must make the **lecture** the thing
you buy, with optional bundles on top — not assume a big multi-lesson course.

**2. Names collide badly.** *"المحاضرة ٢"* exists separately for first, second and third secondary.
*"المحاضرة الاولي"* appears at least four times, sometimes with a trailing space
(`"المحاضرة الاولي "`). With 117 flat items and duplicate names, neither he nor his students can
navigate it. There is no Grade → Term → Lecture hierarchy — just one flat list filtered by grade.

**3. Quizzes and homework are used exactly zero times across 117 items.**
The platform has both features. He uses neither. Either they are too awkward to use, or he does not
want them. **Do not build a quiz engine until he asks for one.** That alone removes about a week
from our plan. The leaderboard confirms it — it exists, it is in the main nav, and it is empty
(*"لا توجد بيانات في لوحة الصدارة بعد"*) because it is scored from quizzes nobody takes.

**4. ~19,000 EGP of lifetime revenue** (296 × ~65 EGP). This is a working side business, not a
startup. The rebuild should reduce his costs and friction, not add operational complexity.

**5. Only 8 items have attached files.** Worth asking whether PDFs matter as much as I assumed.

---

## Problems worth fixing in our version

### 1. The login wall is the biggest commercial mistake

> **الكورسات غير متاحة — يجب تسجيل الدخول أولاً لمشاهدة الكورسات**

A student arriving from a WhatsApp link sees a poster, a wall of text, and a demand to register
before seeing a single course title or price. Every visitor must commit before they know what is on
offer.

And it does not even work as protection: **`/api/courses` returns the entire catalog publicly** —
names, prices, subscriber counts, image paths. The data is hidden from the person who might buy it
while being fully readable by anyone who opens devtools. Worst of both.

**Ours:** public, server-rendered course pages with title, price, curriculum outline and a free
preview lesson. Locked lessons visible but not playable. Login required only to *buy* and *watch*.

### 2. Zero SEO, zero shareability

Client-rendered throughout — every route serves *"جارٍ تحميل المحتوى..."* first. No server-rendered
course pages, so nothing is indexable and nothing produces a decent WhatsApp link preview. Since
**WhatsApp is his entire distribution channel**, a shared course link that unfurls into a proper card
with the lecture title, price and cover image is a direct conversion gain. He currently has none.

### 3. Mobile is where students are, and it is weak

On a 375px screen the hero consumes the whole first viewport, and the courses section is below the
fold behind the login wall. The hero image is a **poster with the teacher's name baked into the
pixels** ("MR.Haitham Sadek") — not selectable, not responsive, blurry on retina. The description is
a bullet list pasted as one run-on paragraph, `•` characters and all, including a stray closing
bracket in his own copy: *"استخدام أساليب تعليم تفاعلية)."*

### 4. Content protection is crude

The only mechanism is `viewLimits: { count: 10, duration: 10 }` — roughly 10 views per 10 days.
Device binding exists (`enforceDeviceBinding`) but is **off**. A view counter does not stop the actual
threat, which is one student downloading a lecture and putting it in a Telegram group.

**Ours:** short-lived signed playback URLs plus a moving watermark carrying the student's name and
phone. The watermark is what changes behaviour — a leaked recording names the leaker.

### 5. Public endpoint leaking the tenant's configuration

`GET /api/admin/settings` is called from the public homepage, unauthenticated, and returns the whole
config: his vendor **subscription renewal date**, his **package tier**, his **per-student price**, his
AI token balance, which payment gateways he has keys for, and every feature flag. No passwords or
API keys — but his commercial terms with his vendor are readable by anyone who visits.

This is the vendor's bug, not his, and he cannot fix it. It is a fair argument for owning the stack.
For our build: settings split into a public subset and an admin-only one, and nothing under an
`/admin` path is ever readable unauthenticated.

### 6. Operational sharp edges

- Uploads live on the app server's local disk (`/uploads/...`) with **Arabic filenames and raw
  spaces in the URL**: `/uploads/course_اسم الفاعل والدرس الاول_1788696294971_....jpeg`. Fragile
  across proxies and CDNs, and lost on any ephemeral filesystem. One profile image is literally named
  `profile_null_...`.
- No archiving concept. 107 dead courses sit in the same list as the 10 live ones, distinguished only
  by an `isActive` flag. There is no notion of an academic year.
- `showStoreInNavbar: true` with `storeEnabled: false` — contradictory flags in the live config.
- Grade dropdown is ordered **ثالث اعدادي, ثالث ثانوي, اول ثانوي, ثاني ثانوي** — alphabetical, not the
  order a student thinks in.

---

## What it does that we should copy

Not everything is bad. These are real, market-correct decisions:

1. **Phone-only authentication.** Registration asks for name, phone, **parent's phone**, grade and
   password. No email anywhere. Correct for this audience — students will not check email, and the
   phone is already the WhatsApp identity.
2. **Parent's phone as a first-class field**, plus `parentMessagingEnabled: true`. Parents pay the
   money and want progress reports. This is a genuine feature, not decoration.
3. **Grade-scoped content** (`showContentByGrade: true`) — a third-secondary student never sees
   preparatory-year material.
4. **A bottom tab bar on mobile.** Right instinct for a phone-first audience.
5. **WhatsApp contact wired into the footer** as a `wa.me` link — exactly the pattern our purchase
   flow will use.
6. **Cairo font, `dir="rtl"`, Arabic throughout.** Matches what we planned.

---

## Consequences for our plan

| Change | Effect |
|---|---|
| Buyable unit is the **lecture**, not the course; bundles layered on top | Reshapes the Phase 2 data model |
| Add **academic year / term** scoping and a real archive | New, avoids the 117-item flat list |
| **Drop the quiz engine** from the committed scope | Removes ~5 days |
| Add **parent phone + parent progress messaging** | Adds ~2 days; strong differentiator |
| Auth is **phone-first, email optional** | Simplifies Phase 1; the email module drops in priority |
| **Public SSR course pages + WhatsApp link previews** | The clearest visible win over the incumbent |
| Watermark + signed URLs instead of a view counter | Real protection, and a selling point |

Net: roughly the same total effort, aimed at things the incumbent gets wrong.

---

## The pitch to the teacher, in one line

He is paying **per active student** for a generic platform that hides his catalog from buyers, cannot
be found on Google, does not preview properly on WhatsApp, and carries another teacher's name in its
configuration. Owning the stack removes the per-student cost, opens the catalog to search and
sharing, and lets the site be built around how he actually sells — one lecture at a time.
