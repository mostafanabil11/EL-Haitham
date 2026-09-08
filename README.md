# منصة الهيثم — Teaching Platform

A private learning platform for a single Arabic-language teacher. Students browse lectures publicly,
pay over WhatsApp, and unlock what they bought with an access code.

- **Backend** — NestJS 10, MongoDB (Mongoose), Zod validation
- **Frontend** — Next.js 16 (App Router), Tailwind 4, Arabic-first RTL

## How the money path works

There is no online payment gateway. The whole loop is deliberate:

1. A student presses **اشترك الآن** on a lecture → a `PurchaseRequest` row is created with a short
   number (`R-2609-0003`), and WhatsApp opens with that number in a prefilled Arabic message.
2. The teacher confirms payment from `/admin/requests`. One click marks it paid **and** mints the
   access code, then hands him a finished reply and a deep link to that student's chat.
3. The student redeems the code once. It binds permanently to their account and grants an
   `Enrollment` — the single thing every content route checks.

## Running it

Both halves need their own `.env`; copy the examples and fill them in.

```bash
cd backend && npm install && cp .env.example .env && npm run start:dev
```

```bash
cd frontend && npm install && cp .env.example .env.local && npm run dev -- -p 3001
```

The frontend proxies `/api/*` to the backend, which keeps the session cookie first-party and lets
pages gate on the server rather than rendering an empty shell.

Create the single admin account (there is no API route that grants the role):

```bash
cd backend && npm run bootstrap:admin
```

Run this on every deploy that changes a schema — Mongoose never drops or alters an existing index:

```bash
cd backend && npm run sync:indexes
```

## Tests

Three end-to-end suites run against a live backend. Start it with the auth throttle raised, or the
functional assertions come back `429` and look like auth failures.

```bash
cd backend && AUTH_THROTTLE_LIMIT=100 REDEEM_THROTTLE_LIMIT=100 npm run start:dev
```

```bash
cd backend && npm run test:e2e:auth && npm run test:e2e:commerce && npm run test:e2e:learn
```

`commerce` and `learn` read `ADMIN_PHONE` and `ADMIN_PASSWORD` from the environment.

## Conventions worth knowing before editing

- **Money is integer minor units** (piastres). `6500` is 65.00 EGP. Format it once, in `formatPrice`.
- **Phones are canonical `201XXXXXXXXX`** in the database and local `01XXXXXXXXX` on screen.
- **Latin digits, Arabic text.** `lang="ar-EG-u-nu-latn"` — Arabic-Indic numerals get misread and
  mistyped, and access codes are dictated over WhatsApp.
- **Logical CSS properties only** — `ps-`/`pe-`/`text-start`, never `pl-`/`pr-`/`text-left`.
- **Access codes exclude `0 O I 1 L`.** Every confusable character becomes a support message.

## Documentation

- [docs/PLAN.md](docs/PLAN.md) — the build plan, phase by phase, with the decisions and their reasons
- [docs/INCUMBENT-REVIEW.md](docs/INCUMBENT-REVIEW.md) — teardown of the rented LMS this replaces
