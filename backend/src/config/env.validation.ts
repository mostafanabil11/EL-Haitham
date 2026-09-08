import { z } from 'zod';

// A key left blank in .env — `BREVO_API_KEY=` — arrives as an empty string,
// not as an absent value, so a plain `.optional()` rejects it and the process
// refuses to boot on a freshly copied .env.example. Every optional variable is
// wrapped so that "" and "not set" mean the same thing, which is what someone
// filling in the file expects.
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  // Not z.url(): a replica-set connection string lists several hosts
  // separated by commas, which is valid Mongo syntax but not a parseable URL,
  // and rejecting it would refuse to boot against a perfectly good cluster.
  // The scheme is the part actually worth checking.
  MONGODB_URI: z
    .string()
    .refine(
      (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
      'MONGODB_URI must start with mongodb:// or mongodb+srv://',
    ),

  // One or more site origins, comma-separated — a deployed site has several
  // (production, custom domain, per-branch previews) and all of them need to
  // pass CORS. Validated per entry so one malformed origin is caught here at
  // boot rather than as a confusing CORS failure in the browser later.
  FRONTEND_URL: z
    .string()
    .default('http://localhost:3001')
    .refine(
      (value) =>
        value
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean)
          .every((url) => URL.canParse(url)),
      'FRONTEND_URL must be a URL, or several comma-separated URLs',
    ),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters — generate one with `openssl rand -base64 48`'),
  JWT_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // --- Admin bootstrap ---
  // The single teacher account. Seeded once by scripts/bootstrap-admin.ts;
  // there is no public path to role: 'admin'.
  ADMIN_PHONE: optional(z.string().regex(/^\d{8,15}$/)),
  ADMIN_PASSWORD: optional(z.string().min(8)),

  // --- Video ---
  // Deliberately deferred. Every provider sits behind the VideoProvider
  // interface, so switching is a one-line env change plus one new class.
  // 'none' serves lectures without playback, which is what local development
  // and the content-authoring phase need.
  VIDEO_PROVIDER: z.enum(['none', 'bunny', 'vimeo', 'youtube']).default('none'),
  VIDEO_TOKEN_TTL_MINUTES: z.string().default('240').transform(Number),

  BUNNY_LIBRARY_ID: optional(z.string()),
  BUNNY_API_KEY: optional(z.string()),
  BUNNY_CDN_HOSTNAME: optional(z.string()),
  BUNNY_TOKEN_KEY: optional(z.string()),

  VIMEO_ACCESS_TOKEN: optional(z.string()),

  // --- Media storage (Cloudflare R2, S3-compatible) ---
  // Lecture covers and PDF attachments. The incumbent writes these to the app
  // server's local disk with raw Arabic filenames and spaces in the URL;
  // object storage with generated keys avoids both problems.
  R2_ACCOUNT_ID: optional(z.string()),
  R2_ACCESS_KEY_ID: optional(z.string()),
  R2_SECRET_ACCESS_KEY: optional(z.string()),
  R2_BUCKET: optional(z.string()),
  R2_PUBLIC_URL: optional(z.string().url()),

  // --- Email ---
  // Brevo's HTTP API is preferred where SMTP ports are blocked (most managed
  // hosts); Gmail over SMTP stays for local development. All optional: the
  // app runs without email, it just delivers nothing. Note that students here
  // register with a phone and no email at all, so email is for the teacher's
  // own account recovery and for optional receipts — not the main channel.
  BREVO_API_KEY: optional(z.string()),
  MAIL_FROM_ADDRESS: optional(z.email()),
  MAIL_FROM_NAME: optional(z.string()),

  EMAIL_USER: optional(z.email()),
  EMAIL_PASSWORD: optional(z.string()),

  // Requests per minute per IP allowed on register / login / password-reset.
  // Deliberately low; raise it only for automated test runs.
  AUTH_THROTTLE_LIMIT: z.string().default('5').transform(Number),

  // Code-redemption attempts per minute per IP. A 12-character code from a
  // 31-character alphabet is not guessable; this caps a script working
  // through a list of leaked codes.
  REDEEM_THROTTLE_LIMIT: z.string().default('5').transform(Number),

  OTP_EXPIRATION_MINUTES: z.string().default('10').transform(Number),
  MAX_LOGIN_ATTEMPTS: z.string().default('5').transform(Number),
  LOCK_TIME_MINUTES: z.string().default('15').transform(Number),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }

  return result.data;
}
