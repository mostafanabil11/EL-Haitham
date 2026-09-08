# Teaching Platform — Build Plan

**Product:** A private learning platform for a single Arabic-language teacher, one subject, sold
directly to students. Payment happens off-platform over WhatsApp; the teacher hands the student an
**access code**, and that code is what unlocks the purchased course or session.

**Stack:** NestJS 10 + MongoDB (Mongoose) backend · Next.js 15 (App Router) frontend · Arabic-first RTL UI.

---

## 0. Decisions already made

| Decision | Choice |
|---|---|
| Backend | NestJS 10, Mongoose, Zod validation — harvested from the clothing-brand backend |
| Frontend | Next.js 15 App Router |
| Payment | Manual, over WhatsApp. No online payment gateway in v1 |
| Access model | Student creates an account, then redeems a code **once**; the code binds permanently to that account |
| Video host | **Deferred.** Build behind a `VideoProvider` interface so the choice is a one-file swap (Phase 4.1) |

### Grounded in the incumbent

The teacher already runs on **haitham-sadeq.lms-r.com**, a rented white-label LMS (Remotily). See
[INCUMBENT-REVIEW.md](./INCUMBENT-REVIEW.md) for the full teardown. The facts that shaped this plan:

- **He sells single lectures at 40–100 EGP, not multi-lesson courses.** 117 items, most with exactly
  one lesson, named *المحاضرة ٢* / *محاضرة ١٢*. The buyable unit is the lecture.
- **107 of 117 items are last-year archive.** Academic-year scoping is a first-class requirement.
- **Zero quizzes and zero homework across all 117 items** — the features exist there and he uses
  neither. The quiz engine is therefore *not* in committed scope.
- **No email anywhere.** Registration is name + phone + **parent's phone** + grade + password.
- 296 lifetime subscriptions since Sept 2025; best single lecture sold 143. A real but modest business.
- He is billed **per active student** by the vendor — growth currently costs him money.

### Assumptions (correct me if wrong)

1. Audience is Egyptian secondary students (grades 1–3 secondary plus 3rd preparatory) studying Arabic
   as a school subject → **UI is Arabic, RTL, EGP prices**.
2. One teacher = one admin account. No multi-tenant, no instructor marketplace, no revenue splitting.
3. Content is **pre-recorded video**, occasionally with a PDF (only 8 of 117 items have files). Live
   sessions, if any, are Zoom/Meet links posted inside a lesson — not built-in streaming.
4. Scale target for year one: low thousands of students. This justifies MongoDB plus a single
   Render/Railway instance rather than anything distributed.
5. Money is stored in **minor units (piastres) as integers**, matching the old backend's convention.

---

## 0.5 What "better than the incumbent" means, concretely

Not a vibe — a checklist, each item traceable to something measured on their live site, and each
with a test that says whether we actually won.

| # | They do | We do | How we prove it |
|---|---|---|---|
| 1 | Catalog hidden behind a login wall, yet `/api/courses` is world-readable | Public SSR lecture pages: title, price, curriculum, free preview. Login only to buy or watch | `curl` the page, see the lecture title in the HTML |
| 2 | Client-rendered; Google and WhatsApp both see "جارٍ تحميل المحتوى..." | Server-rendered with per-lecture OpenGraph images | Paste a link in WhatsApp, get a real card |
| 3 | Whole settings doc public — vendor tier, renewal date, per-student rate, all flags | `GET /settings/public` returns a 10-field allow-list; everything else is admin-only | ✅ **done in Phase 0** — verified 200 vs 401 |
| 4 | Flat list of 117 lectures, duplicate names, `isActive` as the only lifecycle | Grade → Term → Lecture, with academic-year archiving in one move | Roll the year, last year's content leaves the catalog |
| 5 | Anti-sharing = a 10-views-per-10-days counter; device binding off | Short-lived signed URLs + a moving watermark carrying the student's name and phone | A leaked recording identifies who leaked it |
| 6 | Payment reconciled by hand against WhatsApp messages | Every sale is a `PurchaseRequest` row: pending → paid → code issued, with a prefilled `wa.me` message | No sale exists only in a chat log |
| 7 | Files on local disk, raw Arabic names and spaces in URLs | R2 object storage with generated keys | URLs survive a redeploy |
| 8 | Billed **per active student** — growth costs him money | Flat hosting, ~$25/mo at launch scale | His 1000th student costs the same as his 10th |
| 9 | Quizzes, homework, certificates, leaderboard — all shipped, all unused | Not built. Effort goes to parent reports instead | Ships ~5 days sooner |
| 10 | Password minimum 6 characters | Minimum 8 | — |
| 11 | Grade dropdown ordered alphabetically | Ordered the way a student thinks: prep 3 → sec 1 → sec 2 → sec 3 | — |
| 12 | Teacher bio contains **another teacher's name** | His actual name, and settings that are his | — |

Two things they get right that we copy outright: **phone-only auth with a parent's phone**, and
`lang="ar-EG-u-nu-latn"` to force Latin digits in an otherwise Arabic page. Both are already in.

---

## 1. What we reuse from the clothing-brand backend

The old backend is genuinely well-built in the areas that matter here. Roughly 40% transfers.

### Copy nearly as-is

| Module | Why it transfers | Changes needed |
|---|---|---|
| `auth/` (whole module) | JWT access + rotating refresh tokens, per-device `Session[]` subdocs, OTP email verification, password reset via sha256 token, login-attempt lockout, Google OAuth | Add `phone` (WhatsApp number) to `User`; roles become `student` / `admin`; make Google optional |
| `common/guards/roles.guard.ts` + `decorators/roles.decorator.ts` | Role gating is identical | None |
| `common/filters/http-exception.filter.ts` | Consistent error envelope | None |
| `common/pipes/zod-validation.pipe.ts` + `nestjs-zod` setup | Validation approach carries over | None |
| `config/` (`config.service.ts`, `env.validation.ts`) | Zod-validated env at boot, multi-origin CORS handling | Drop Paymob vars, add video-provider + WhatsApp vars |
| `auth/services/email.service.ts` + `utils/email.utils.ts` | Brevo HTTP API with SMTP fallback — the Brevo path exists precisely because managed hosts block SMTP ports. Same problem here | Replace commerce templates with: code delivered, enrollment granted, new lesson published, access expiring |
| `admin/` audit log + `audit.interceptor.ts` | Every admin action on codes and enrollments must be traceable | Extend the action enum |
| `settings/` singleton | Same upsert-one-document pattern | New fields (see section 2) |
| `main.ts`, `app.module.ts` skeleton | helmet, cookie-parser, trust-proxy, throttler tiers, Swagger-in-dev-only | Swap the module list |
| `common/utils/slugify.util.ts` | Course slugs | Must handle Arabic — transliterate, or allow Arabic slugs |
| `orders/schemas/counter.schema.ts` | Atomic sequence generator — reuse for human-readable purchase-request numbers | None |

### Adapt (same shape, new domain)

| Old | New | Notes |
|---|---|---|
| `coupons/` | `access-codes/` | **The closest analogue in the whole codebase.** Unique uppercase code, `usageLimit`/`usedCount` atomic guard, `startsAt`/`endsAt`, `isActive`, and a separate `CouponRedemption` collection whose *partial unique index* enforces one-redemption-per-person under concurrency. Copy that index reasoning verbatim |
| `products/` | `courses/` + `lessons/` | Publish/unpublish, ordering, slug lookup, admin CRUD all transfer |
| `categories/` | `course-groups/` (optional) | Only if courses need grouping by grade/term. Otherwise drop |
| `orders/` | `purchase-requests/` | An order becomes a WhatsApp purchase intent: pending → paid → code issued |
| `reviews/` | `testimonials/` (Phase 6) | The moderation flow is identical |

### Delete outright

`cart/`, `addresses/`, `wishlist/`, `back-in-stock/`, `payment/` (Paymob),
`products/schemas/product-size-stock.schema.ts`, `stock-movement.schema.ts`, `database/seeds/*`.

> Keep the Paymob module in an `_archive/` folder rather than deleting it — when online payment
> arrives in v2 it is the fastest path.

### Missing from the old backend, must be built new

- **File/media upload.** The storefront stored image *paths* and served static files. A teaching
  platform needs real uploads (PDFs, lesson attachments, course covers) → S3-compatible storage
  (Cloudflare R2) with presigned PUT URLs.
- **Video pipeline.** Nothing analogous exists.
- **Progress tracking.** Nothing analogous exists.
- **Quiz engine.** Nothing analogous exists.

---

## 2. Data model

The hierarchy is **Grade → AcademicYear/Term → Lecture**, and the **Lecture is what a student buys**.
A `Bundle` sits on top for the cases where he sells several at once (a full month, *ليالي الامتحان*).

```
User             — reuse + phone (unique, login identifier), parentPhone, role: 'student'|'admin',
                   grade: 'prep3'|'sec1'|'sec2'|'sec3', email (optional)
Term             — titleAr ("الترم الأول"), grade, academicYear ("2026/2027"), order, isArchived
Lecture          — the buyable unit. titleAr, slug, term, grade, academicYear,
                   priceMinorUnits, coverImage, description,
                   isPublished, publishedAt, order, isArchived,
                   accessDurationDays (null = until end of academic year),
                   contentCount, totalDurationSeconds
LectureItem      — lecture, titleAr, type: 'video'|'pdf'|'text'|'live',
                   videoAssetId, videoDurationSeconds, contentHtml, attachments[],
                   isFreePreview, order
Bundle           — titleAr, lectures[], priceMinorUnits, grade, academicYear, isPublished
AccessCode       — code (unique, uppercase), target: { kind: 'lecture'|'bundle', ref },
                   status: 'unused'|'redeemed'|'revoked', redeemedBy, redeemedAt,
                   expiresAt, batchId, issuedFor (purchaseRequest), note
Enrollment       — user, lecture, source: 'code'|'manual'|'gift', accessCode, bundle,
                   grantedAt, expiresAt, isActive
PurchaseRequest  — requestNumber (counter), user, target (lecture|bundle), priceMinorUnits, phone,
                   status: 'pending'|'paid'|'cancelled'|'expired', paidAt, issuedCode, adminNote
Progress         — user, lectureItem, lecture, lastPositionSeconds, watchedSeconds, completedAt
Announcement     — titleAr, bodyHtml, audience: 'all'|'grade'|'lecture', target, publishedAt
AuditLog         — reuse
Settings         — PUBLIC subset: siteTitle, heroText, socialLinks, whatsappNumber, isRegistrationOpen
                   ADMIN-only subset: everything else. Never one endpoint for both (see review §5)
Quiz / Question / QuizAttempt     — designed, NOT built. See Phase 6
```

### Why a bundle expands, rather than being the unit of access

Redeeming a bundle code writes **one `Enrollment` row per lecture**, not a single bundle enrollment.
The access check then stays one shape — "is there an active enrollment for this lecture?" — and the
teacher can revoke or extend a single lecture out of a bundle without special-casing anything.

### The two ideas worth being precise about

**A code is not access.** `AccessCode` is the *voucher*; `Enrollment` is the *entitlement*. Redeeming a
code creates an enrollment, but the teacher can also grant an enrollment manually (a scholarship, a
support case), revoke one without touching the code, or extend an expiry. Collapsing these two into
one document is the mistake that makes every future support request painful.

**Redemption must be atomic.** Two students entering the same code at the same instant must not both
get in. One `findOneAndUpdate({ code, status: 'unused' }, { $set: { status: 'redeemed', ... } })` is
the whole guard — the same technique the old `CouponsService` uses for its `usedCount < usageLimit`
check, and `coupons.concurrency.spec.ts` is worth copying as the test template.

---

## Phase 0 — Foundations ✅ DONE

**Goal:** an empty but correct skeleton that boots, connects, and deploys.

**Delivered:**
- `backend/` — NestJS 10 harvested from the clothing project, stripped to `auth`, `common`, `config`,
  `admin`, `settings`. Commerce dashboard aggregation removed from `AdminService`; `coupons/` and
  `orders/` kept under `_reference/` as templates for access-codes and purchase-requests; Paymob
  parked in `_archive/`. Builds clean, boots clean, `/health` returns 200.
- **Settings split into public and admin** — `GET /settings/public` serves a 10-field allow-list,
  `GET /settings` and `PATCH /settings` are 401 without an admin token. Verified. This is win #3.
- `env.validation.ts` rewritten: Paymob out; video provider, R2, and admin bootstrap in. Optional
  vars now accept a blank value, so a freshly copied `.env.example` boots instead of throwing.
- `frontend/` — Next.js 16.3.4, App Router, Tailwind 4, Cairo, `dir="rtl"`,
  `lang="ar-EG-u-nu-latn"`. Home page fetches `/settings/public` **server-side**; the fetched value
  appears in the raw HTML, which is win #2's foundation.
- Repo initialised at the root; `.gitignore` verified to exclude every `.env`, `dist/`, `.next/`.

**Not yet done:** Atlas / Render / Vercel provisioning — needs your accounts.

**Original steps, for reference:**

1. `backend/` — copy the old Nest project, strip it to `auth`, `common`, `config`, `admin`, `settings`.
   Rename the package, reset the version, clear `dist/` and the old `.env`.
2. Prune `app.module.ts` to the surviving modules. Confirm `npm run start:dev` boots clean.
3. Rewrite `env.validation.ts`: drop Paymob, add `R2_*`, `VIDEO_PROVIDER`, `WHATSAPP_NUMBER`,
   `ADMIN_EMAIL`. Generate a fresh `JWT_SECRET`.
4. `frontend/` — `create-next-app` (TypeScript, App Router, Tailwind), then set
   `<html lang="ar" dir="rtl">`, install an Arabic font (Cairo or IBM Plex Sans Arabic), and
   configure Tailwind to use **logical properties** (`ps-`/`pe-`, not `pl-`/`pr-`).
5. `git init` at the repo root, one commit per phase from here on. `.gitignore` covering
   `.env`, `dist`, `node_modules`, `.next`.
6. Provision: MongoDB Atlas free cluster, Render (backend), Vercel (frontend). Wire both to the repo
   and confirm a deployed health check responds before writing any feature code.

**Done when:** the deployed backend `/health` returns 200 and the deployed frontend renders an RTL page.

---

## Phase 1 — Auth & accounts ✅ DONE

**Goal:** students can register and sign in; one admin exists.

**Delivered:** phone-based identity end to end, verified by a 14-check e2e suite
(`npm run test:e2e:auth`) plus a browser pass on a 375px viewport.

- `User` reshaped: `phone` (unique login identifier), `parentPhone`, single `name`, `grade` enum,
  optional `email`, roles `student` / `admin`. `grade` is conditionally required — students must have
  one, the teacher's account must not.
- **Google OAuth removed.** It returns an email and no phone, so it would create accounts missing the
  two fields the whole system depends on.
- **Email OTP gate removed.** Students have no email; login is deliberately not gated on
  `isPhoneVerified`, because gating on a check that cannot run locks everyone out. OTP utils kept for
  when WhatsApp OTP lands.
- `normalizeEgyptianPhone()` canonicalises `01…`, `201…`, `+20 1…` and Arabic-Indic digits to
  `201XXXXXXXXX`, so one person cannot get two accounts by typing their number differently.
- Password floor raised 6 → 8. Registration signs the student straight in (no second form).
- **Admin-initiated password reset** — the only reset path for a student with no email, audited.
- `scripts/bootstrap-admin.ts` — the only way to create an admin. No API route grants the role.
- Frontend: `/login`, `/register`, `/dashboard`, all Arabic RTL, with per-field validation errors.
  API proxied through Next rewrites so the session cookie is first-party and pages gate **on the
  server** — an anonymous `/dashboard` request returns `307 → /login` with zero protected content in
  the body.

**Two findings worth carrying forward:**

1. **Mongoose never drops or alters an existing index.** `email` was `required + unique` in the
   storefront, so a plain `email_1` index survived into this database and rejected the second student
   with a null email — even though the schema declares a partial index that allows it. Fixed, and
   `scripts/sync-indexes.ts` now reconciles both directions. **Run it on every deploy that changes a
   schema.**
2. **The per-IP throttle (5/min) fires long before the per-account lockout (5 failures).** Both are
   wanted — the throttler stops one machine hammering, the lockout stops a distributed attack the
   throttler cannot see. Worth revisiting later: since phone numbers are semi-public among
   classmates, someone could deliberately fail 5 logins to lock a student out for 15 minutes. Raising
   the threshold or shortening the lock is the mitigation if it ever happens.

**Original steps, for reference:**

1. **Phone is the login identifier**, not email — confirmed by the incumbent, which asks for no email
   at all. `phone` becomes required + unique on `User`; email becomes optional.
2. Add **`parentPhone`** (required). Parents pay and want progress; the incumbent treats this as a
   first-class field and it feeds the parent reports in Phase 6.
3. Rework verification: OTP over **WhatsApp/SMS**, not email. For v1, keep it simple — accept the phone
   as given and verify lazily, since the teacher confirms every purchase by hand over WhatsApp anyway
   and that conversation *is* the verification. Revisit if fake signups appear.
4. `RegisterDto`: name, phone, parentPhone, grade, password. Enforce a **minimum of 8 characters** —
   the incumbent allows 6.
5. Grade is a fixed enum rendered in **school order** (prep 3 → sec 1 → sec 2 → sec 3), not
   alphabetically as the incumbent does.
6. Seed the single admin from env plus a one-shot bootstrap script. No public path to `role: 'admin'`.
7. Keep the throttle tiers exactly as the old controller sets them (5/min on register, login, reset).
8. Frontend: register, login, forgot/reset password — all RTL, all Arabic copy.
9. Session handling in Next.js: the Nest controller already sets httpOnly cookies; add a middleware
   that refreshes on 401 and a server-side `getCurrentUser()` for protected layouts.

**Done when:** a student can register on the deployed site with a phone number and land on an
(empty) dashboard.

---

## Phase 2 — Content model & public catalogue ✅ MOSTLY DONE

**Goal:** the teacher can build the full content tree, and the public can browse it.

**Delivered — backend:**
- `Term` → `Lecture` → `LectureItem`, with the **lecture as the buyable unit**, matching how he
  actually sells. Grade and academic year are denormalized onto the lecture for the catalogue query
  and kept in step by the services.
- **Arabic slugs.** The inherited `slugify` was `replace(/[^a-z0-9]+/g,'-')`, which reduces every
  Arabic title to the empty string — all 117 lectures would have collided on one empty slug.
  Replaced with a transliterator: `النحو — الجملة الاسمية` → `alnhw-algmla-alasmya`, Arabic-Indic
  digits converted, collisions suffixed. Slugs freeze on publish so shared WhatsApp links never 404.
- Publishing an empty lecture is refused; deleting the last item unpublishes it automatically.
- `archiveAcademicYear()` retires a whole year in one move — the thing the incumbent has no concept
  of, which is why 107 of its 117 items sit dead in the live list.
- Full admin CRUD, reorder (idempotent whole-array), and audit entries on every mutation.

**Delivered — public catalogue (the differentiator):**
- `/catalog/lectures` and `/catalog/lectures/:slug` are **public by design**. The curriculum outline
  — titles, types, durations, which parts are free — is visible to anyone; `videoAssetId`,
  `attachments` and non-preview `contentHtml` are stripped from the payload. Verified: 0 occurrences
  of either in the response or the rendered HTML.
- Frontend `/`, `/lectures`, `/lectures/[slug]`, all server-rendered.
- **WhatsApp link previews work.** A shared lecture URL unfurls with title, price and description
  because the og: tags are in the server HTML:
  `og:title = "النحو — الجملة الاسمية — 75 ج.م"`. The incumbent's unfurl blank.
- Purchase CTA builds a `wa.me` deep link with a prefilled Arabic message naming the lecture and
  price. Phase 3 adds the purchase-request number to it.

**Not yet done in this phase:**
- **Media upload (R2)** — needs credentials; `isR2Configured` already gates it. The lecture editor
  says so in place of a file picker rather than offering an upload that cannot work.
- ~~**Admin UI**~~ — delivered in Phase 5.

**Live on Atlas:** indexes synced, admin bootstrapped, branding set, 11 demo lectures seeded across
four grades (`npm run seed:demo -- --clear` removes them).

**Original steps, for reference:**

1. Schemas: `Course`, `Section`, `Lesson` (indexes: `course+order`, unique `slug`).
2. `CoursesService` — CRUD, publish/unpublish, reorder, slug generation from Arabic titles.
   *Slug decision:* transliterate to Latin (`nahw-thanawya-3`) rather than percent-encoded Arabic URLs.
   Cleaner to share over WhatsApp, which is the main distribution channel.
3. `LessonsService` — CRUD, reorder within a section, mark `isFreePreview`.
4. **Media module** (new): Cloudflare R2 + presigned PUT. Endpoints: `POST /media/upload-url`
   (admin only, returns presigned URL + final key) and `DELETE /media/:key`. Validate MIME type and
   size caps server-side; never trust the client's declared type.
5. Denormalize `lessonCount` and `totalDurationSeconds` onto `Course`, recomputed on lesson write.
   The catalog page reads these on every render; aggregating per request is wasteful.
6. Admin UI (`/admin`): course list, course editor, drag-to-reorder sections and lessons,
   attachment uploader.
7. Extend the audit interceptor to cover course and lesson mutations.

**Done when:** the teacher can build a complete course with sections, lessons, and PDFs from the admin UI.

---

## Phase 3 — Access codes, purchase requests, enrollments ✅ DONE ⭐

**Delivered.** 27/27 e2e checks pass (`npm run test:e2e:commerce`), including the concurrency case,
and the whole journey was driven through a browser end to end.

**The full loop works:** student taps buy → `PurchaseRequest` created with number `R-2609-0003` →
WhatsApp opens with a prefilled Arabic message carrying that number → teacher confirms with one
click, which marks it paid *and* mints the code in the same step → he pastes the generated reply
back into the chat → student redeems → lecture appears in their dashboard, and the lecture page
switches from a buy button to "أنت مشترك في هذه المحاضرة".

**Concurrency, proven not asserted.** Eight students redeeming one code simultaneously:

```
statuses: 200, 409, 409, 409, 409, 409, 409, 409
exactly ONE student actually gained access
```

The guard is a single `findOneAndUpdate({ code, status: 'unused' })` — Mongo makes that atomic, so
there is no read-then-write window. Granting happens after the claim rather than inside a
transaction, because the unique index on `{user, lecture}` already makes granting idempotent; a
transaction would add a replica-set requirement for a guarantee the index provides. A failed grant
rolls the claim back so a code never dies holding nothing.

**Decisions worth recording:**
- **Codes are stored in plaintext.** The teacher has to read one off his screen and type it into
  WhatsApp; a hashed code could never be shown again, which would break the only delivery mechanism
  the business has. Admin-only and audit-logged.
- **Alphabet excludes `0 O I 1 L`.** Those four confusions are most mistyped codes, and every one
  becomes a WhatsApp message he answers by hand. 31 chars × 12 ≈ 7.9 × 10^17.
- **Redemption accepts sloppy input** — lowercase, missing dashes, Arabic-Indic digits. Verified in
  the browser by typing `5hh5dja52uyn` for `5HH5-DJA5-2UYN`.
- **Four distinct failure messages**, not one "invalid code": unknown / already used by you /
  used by another account / revoked. The third is also the teacher's signal that a code leaked.
- **Revoking a redeemed code does NOT strip access** — that would take a lecture from someone who
  paid. Enrollment revocation is separate and explicit.
- **A bundle expands to one enrollment per lecture**, so every gate asks one question.
- **Access expires at end of academic year** (31 Aug of the closing year), overridable per lecture.

**Two bugs the tests caught:**
1. `requestNumber` was `R-09-0001` — the year was being sliced off. September 2027 would have
   collided with September 2026 on a uniquely-indexed field. Now `R-2609-0003`.
2. The redemption throttle was hardcoded at 5/min, so the concurrency test hit 429 eight times and
   never reached the code. Now `REDEEM_THROTTLE_LIMIT`, defaulting to 5.

**Not yet done:** bundle CRUD endpoints (schema and
redemption path done).

---

### Original plan for this phase, for reference

### 3.1 Purchase request — the WhatsApp handshake

Without this, the teacher is manually reconciling WhatsApp messages against a spreadsheet. With it,
every sale has a row.

1. Student presses **اشترك الآن** on a course → `POST /purchase-requests` creates a `pending` row with
   a short `requestNumber` (reuse `counter.schema.ts`).
2. The frontend immediately opens a `wa.me/<teacherNumber>?text=...` deep link with a **prefilled
   Arabic message** containing the request number, course title, and price. Zero API cost, zero setup —
   the student just presses send.
3. The teacher sees pending requests in `/admin/requests`. Confirming payment (**تأكيد الدفع**) marks it
   paid, generates a code, and optionally emails it.
4. Auto-expire `pending` requests after 48h via a scheduled job — the old `orders.scheduler.ts` is the
   template.

### 3.2 Access codes

1. `AccessCode` schema plus a unique index on `code`.
2. Generator: `crypto.randomBytes`, alphabet **excluding `0 O I 1 l`** — these get misread and mistyped
   constantly over WhatsApp. Format `XXXX-XXXX-XXXX`, roughly a 32^12 space.
3. Batch generation: `POST /admin/access-codes/batch` → N codes for a course, tagged with a `batchId`,
   exportable to CSV so the teacher can hand out codes in bulk at a center or school.
4. Store codes **in plaintext** — the teacher must be able to read and resend them. Access is admin-only
   and audit-logged; that is the correct tradeoff here.
5. Admin actions: revoke, view redeemer, resend, filter by status/batch/course.

### 3.3 Redemption

1. `POST /access-codes/redeem`, authenticated students only.
2. Atomic `findOneAndUpdate` on `{ code, status: 'unused' }`. When it returns null, distinguish the
   cases in the error message — wrong code / already used / revoked / expired. Vague errors here
   generate support messages.
3. Inside a Mongo session/transaction: mark redeemed **and** create the `Enrollment` with
   `expiresAt = now + course.accessDurationDays`.
4. Throttle to **5 attempts/min and 20/day per account**. A 12-char code is not brute-forceable, but
   the throttle also caps a scripted "try leaked codes" attack.
5. Reject redeeming a code for a course the student already holds — that is a refund/support case,
   not a silent no-op.
6. Copy `coupons.concurrency.spec.ts` into `access-codes.concurrency.spec.ts` and prove that two
   parallel redemptions of one code produce exactly one enrollment.

### 3.4 Enrollments

1. An `EnrollmentsGuard` / `@RequiresEnrollment()` decorator — the single chokepoint every content
   route passes through. Do not scatter enrollment checks across services.
2. Admin: grant manually, revoke, extend expiry.
3. Scheduled job: deactivate expired enrollments daily; email a warning 7 days before expiry.

**Done when:** end to end — student requests → WhatsApp → teacher confirms → code issued → student
redeems → course appears in their dashboard. Concurrency test passes.

---

## Phase 4 — Student learning experience ✅ CORE DONE (video provider pending)

**Delivered.** 26/26 access-gate checks pass (`npm run test:e2e:learn`), written from the attacker's
side — every check asks whether paid content can be reached without paying.

**The gate holds.** One implementation of "may this person see this" (`LearnService.assertCanView`),
so two call sites cannot drift apart. Verified against three attackers:

| Attacker | Result |
|---|---|
| Anonymous visitor | Reads the outline; `contentHtml` null, `attachments` empty, **zero `videoAssetId` anywhere in the payload**; playback 403 |
| Signed-in student who bought nothing | `hasAccess: false`, playback 403, and progress-forging 403 |
| Student who bought a *different* lecture | No cross-access; playback on the other lecture 403 |
| Anonymous on a **free preview** | Plays — deliberately, and with a watermark |

**Playback URLs are never in a page payload.** There is no `getPlaybackUrl(assetId)` on the
interface at all — minting always requires knowing *who* is watching, so a caller cannot
accidentally produce a shareable link. Tickets are minted on play, not on render, so the short life
starts when watching starts.

**Watermark** — name + phone, drifting across nine positions on a slow cycle so a crop that removes
it also removes a corner of the video. Verified server-side that it carries *that* student's real
name and number. It does not prevent screen recording — nothing does, DRM included — it makes a
leaked recording identify its leaker.

**Progress** has two independent defences against faking completion: the DTO caps position at 12
hours, and `furthestSeconds` advances by at most 90s per report, so dragging the scrub bar cannot
mark a lecture complete. Completion is at **90%**, not 100% — outros mean nobody reaches the true
end, and a 100% rule silently reports that no student ever finishes anything.

**Still pending:** the provider class itself. `VIDEO_PROVIDER=none` returns an honest "no playback
available" ticket, so everything above is built and tested; only the video is missing. Choosing a
host means writing one class and changing one env var.

**Also not yet done:** admin UI screens, media upload (needs R2 credentials).

### 4.1 Video abstraction (build this before choosing a provider)

```ts
interface VideoProvider {
  createUploadUrl(lessonId: string): Promise<{ uploadUrl: string; assetId: string }>;
  getPlaybackToken(assetId: string, userId: string): Promise<{ url: string; expiresAt: Date }>;
  deleteAsset(assetId: string): Promise<void>;
}
```

- `GET /lessons/:id/playback` → enrollment check → returns a **short-lived (2–4h) signed URL**. The raw
  provider URL never appears in the page source, in API list responses, or in the JS bundle.
- Implementations to write once the decision lands: `BunnyStreamProvider`, `VimeoProvider`,
  `YouTubeProvider`. Selected by a `VIDEO_PROVIDER` env var.
- **Recommendation when you decide:** Bunny.net Stream, on the **Volume** delivery tier. Token
  authentication, hotlink protection, free ABR transcoding, TUS resumable direct upload (so a lecture
  never passes through Render), and raw HLS output — which matters because the player stays ours, and
  the watermark overlay sits in our own DOM rather than over a vendor iframe.
  - **The tier is the whole cost story.** $0.005/GB is the Volume rate. On Standard, Middle East &
    Africa is $0.06/GB — Bunny's most expensive region, 12× the bill for the same traffic.
  - Per-view watermarking is *not* a reason to pick it: we do that client-side already. That is also
    what rules out VdoCipher and Gumlet, whose DRM-plus-burned-in-watermark pitch aims at exactly
    this market but whose entry tiers exceed the platform's current annual revenue.
  - Priced per minute delivered, Cloudflare Stream and Mux both land in the hundreds per month at
    this watch-time. YouTube unlisted is free and has no gate at all, which discards the one thing
    being sold over the incumbent.
- Regardless of provider: overlay the student's **name and phone, semi-transparent, slowly moving**
  across the player. It will not stop a determined ripper; it does stop casual screen-recording and
  resharing, because the recording identifies the leaker.

### 4.2 Student surface

1. `/` — landing: teacher intro, courses, testimonials, Arabic-first copy.
2. `/courses` and `/courses/[slug]` — public course page (SSR for SEO). Curriculum outline with locked
   lessons visible but not playable; free-preview lessons playable.
3. `/dashboard` — my courses, continue watching, progress bars.
4. `/learn/[courseSlug]/[lessonId]` — player, curriculum sidebar, attachments, notes.
5. `/redeem` — the code entry page. Make it prominent; students will be sent straight here.
6. Progress: `POST /progress` throttled to one write per ~15s of playback; resume from
   `lastPositionSeconds`. Mark complete at **90%** watched, not 100% — outros mean students never hit
   100 and the completion metric silently breaks.

### 4.3 Arabic/RTL specifics

- `dir="rtl"` at the root; logical CSS properties everywhere.
- Font: Cairo or IBM Plex Sans Arabic. Both have real Arabic weights; system fallbacks look bad.
- Numerals: **Western digits (1, 2, 3)** for prices, durations and codes — Arabic-Indic numerals in a
  code field cause input errors. Body text stays Arabic.
- The video player needs explicit RTL handling; most players assume an LTR seek bar.

**Done when:** a student can watch a purchased lesson end to end, close the tab, and resume where they
stopped.

---

## Phase 5 — Teacher dashboard ✅ DONE

**Delivered.** Eight admin routes under `/admin`, all server-rendered and all dynamic. The whole
loop was driven through a browser: confirm a payment → code issued → WhatsApp message ready; grant a
lecture by hand → enrollment appears, expiring 31 Aug as the default rule says.

**Gated twice, independently.** `app/admin/layout.tsx` resolves the session on the server: no session
redirects to `/login?next=/admin` (verified: 307, zero admin markup in the body), and a signed-in
student gets `notFound()` rather than a redirect — a student who guesses the URL learns nothing about
whether an admin area exists. The API enforces `@Roles('admin')` on every route regardless; the
layout is the second lock, not the only one.

| Route | What it is for |
|---|---|
| `/admin` | The morning screen: pending queue, revenue this month, active enrollments, most-watched |
| `/admin/requests` | The money path — status tabs, one-click confirm, WhatsApp handoff |
| `/admin/codes` | Batch generation, filter by status/batch, revoke, CSV export |
| `/admin/students` | Phone-first search, then the per-student drill-down |
| `/admin/students/[id]` | Enrollments, progress, codes, requests, grant access, reset password |
| `/admin/content` | Terms grouped by grade, lectures under each, archive |
| `/admin/content/lectures/[id]` | Lecture settings, publish, and the item list with reorder |
| `/admin/settings` | Site copy, WhatsApp number, academic year, registration switch |

**Two decisions worth recording:**

1. **Confirming a payment does not re-fetch the list.** The obvious `router.refresh()` after a
   confirm is wrong here, and the browser pass caught it: this screen defaults to the *pending*
   filter, so refreshing drops the row that was just confirmed — and the code and the WhatsApp
   button go with it, before the teacher has sent anything. The row now stays put, re-labelled
   مؤكد, until he navigates away himself.
2. **The WhatsApp reply is a deep link to that student's chat**, not just a code on screen. The code
   is not the deliverable; getting it into the right conversation is. `wa.me/<student phone>` with
   the message prefilled turns the last step into one tap.

**New backend surface:** `GET /admin/overview` (the dashboard counters) and `GET /admin/students/:id`
(the drill-down). Both read-only, both admin-gated. `AdminModule` now registers `Enrollment`,
`AccessCode`, `PurchaseRequest`, `Lecture` and `Progress` read-only for these two aggregations.

**Not yet done:** announcements (item 6 — moved to Phase 6 with the rest of the messaging work);
scheduled publish; bundle CRUD screens; attachment upload, which is blocked on R2 credentials.

**A bug this phase found in the API:** `GET /admin/content/lectures` shares its query DTO with the
public catalogue, which caps `limit` at 60 — but the admin handler ignores pagination and returns
everything. Passing a limit large enough for a real year (117 lectures) therefore 400s and silently
empties the list. The client now sends no `limit` at all. Worth a look on the API side.

---

## Phase 6 — Parent reports & engagement (~3 days)

Scope deliberately cut. The incumbent has quizzes, homework, certificates and a leaderboard, and
across 117 lectures the teacher has used **none of them**. Building a quiz engine on that evidence
would be building for an imagined user.

1. **Parent progress reports** ⭐ — the one thing worth adding that the incumbent only half-does. A
   monthly WhatsApp-ready summary per student (lectures purchased, % watched, last active) that the
   teacher sends to `parentPhone` in one click. Parents are the payers; this is what renews them.
2. **Notifications**: in-app bell plus WhatsApp-link nudges for a new lecture and for expiring access.
3. **Testimonials**: adapt `reviews/` with its moderation flow. Cheap, and the incumbent's reviews
   section sits switched off.
4. **Announcements** to all students, one grade, or one lecture.

**Deferred until the teacher asks for them:** quizzes, homework submission, certificates,
leaderboard. Schemas are sketched in section 2 so adding them later is not a rewrite.

---

## Phase 7 — Hardening & launch prep (~4 days)

1. **Anti-sharing review:** short-lived signed URLs · watermark on · one active enrollment per code ·
   log playback requests per user and flag anomalies (one account playing from many IPs/cities in a
   day). Decide *then* whether a device cap is warranted — adding it pre-emptively creates support
   burden for students who legitimately change phones.
2. **Security:** rerun the old backend's threat surface — throttle tiers, helmet, CORS origins, Swagger
   off in production, no admin-role escalation path, audit coverage on every money/access mutation.
   Run `/security-review` on the diff.
3. **Performance:** index review (`Enrollment{user,course}`, `LessonProgress{user,lesson}`,
   `AccessCode{code}`, `Lesson{course,order}`), N+1 sweep, Next.js image optimization, CDN caching on
   public course pages.
4. **SEO:** Arabic metadata, OpenGraph images — WhatsApp link previews matter enormously here, since
   every share goes through WhatsApp — plus sitemap and JSON-LD `Course` schema.
5. **Testing:** e2e on the three flows that lose money if broken — register → redeem → watch;
   purchase request → confirm → code; expiry → access revoked.
6. **Ops:** Atlas automated backups, Sentry, uptime monitor, a documented restore procedure.
7. **Content seeding:** the teacher uploads one real course fully before launch. Do not launch on
   placeholder content.

---

## Phase 8 — Launch & iterate

1. Soft launch to ~20 students. Watch the support questions — they will cluster on code entry and video
   playback, and they tell you what to fix.
2. Instrument: redemption success rate, playback error rate, drop-off per lesson.
3. v2 backlog: online payment (the Paymob module is archived and ready), live sessions, mobile app,
   parent progress reports, referral discounts.

---

## Timeline

| Phase | Days | Cumulative |
|---|---|---|
| 0 Foundations | 2 | 2 |
| 1 Auth | 3 | 5 |
| 2 Content + admin CRUD | 5 | 10 |
| 3 Codes + purchases ⭐ | 5 | 15 |
| 4 Student experience | 6 | 21 |
| 5 Teacher dashboard ✅ | 3 | 24 |
| 6 Parent reports + engagement | 3 | 27 |
| 7 Hardening | 4 | 31 |
| 8 Launch + content migration | 3 | 34 |

**Roughly 6–7 weeks of focused work.** A shippable MVP exists at the end of Phase 5 (~24 days) —
Phase 6 can follow once real students are on the platform.

### Migration off the incumbent (Phase 8)

117 lectures and ~300 subscription records live in the current system. The public `/api/courses`
endpoint exposes the catalog metadata, but **video assets and student accounts do not come out
through any public surface** — ask Remotily for an export, or expect to re-upload. Plan for:
only the ~10 active lectures migrating before launch, the archive following later or not at all,
and students re-registering (they have no email, so there is nothing to bulk-invite with — the
migration announcement goes out over WhatsApp).

---

## Running costs (estimate)

| Item | Cost |
|---|---|
| MongoDB Atlas M0 | Free (M10 at ~$57/mo only if needed) |
| Render backend | Free tier, or $7/mo to avoid cold starts — **worth paying**; cold starts on a video-gating API are visible to students |
| Vercel frontend | Free |
| Cloudflare R2 (PDFs) | ~$0.015/GB, no egress fees |
| Video (Bunny estimate) | **$0.005/GB on the Volume tier only.** 500 students × 10h ≈ 2,500GB ≈ **$12/mo** + ~$2 storage. On the Standard tier, Middle East & Africa is $0.06/GB — the same traffic bills ~$150. Attach the video library to a **Volume-tier** pull zone. |
| Brevo email | Free to 300/day |
| Domain | ~$12/yr |

Under $25/month at launch scale.

---

## Open questions to resolve before Phase 4

1. **Video provider** — deferred by design; needed by Phase 4.1.
2. **Access duration** — lifetime, or until the end of the academic year? The incumbent archives
   everything yearly, which suggests year-scoped access. Recommendation: per-lecture
   `accessDurationDays`, defaulting to the end of the academic year.
3. **Bundles** — does he actually sell month packages or *ليالي الامتحان* as one purchase? The best-
   selling item had 143 subscribers, which looks like a bundle-shaped product.
4. **Refunds** — is a redeemed code ever reversed? This defines whether revoking restores the code to
   `unused`.
5. **Quizzes** — confirm he genuinely does not want them before we lock the reduced scope. The data
   says he has never used one, but he may simply have found the incumbent's version unusable.
6. **Video export** — can Remotily export his existing lecture videos, or is re-upload the only path?
   This is the largest unknown in the migration.
