// Parses simple duration strings used in JWT_EXPIRATION-style env vars (e.g. "15m", "7d", "1h")
// into milliseconds, for use as a cookie maxAge. Not a general-purpose parser — only
// supports the single-unit formats this app actually uses.
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Unsupported duration format: "${duration}"`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * unitMs[unit];
}
