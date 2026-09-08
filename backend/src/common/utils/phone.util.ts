// Phone numbers are this platform's primary identity — students register with
// one and no email at all — so a single canonical stored form matters more
// than usual. Two rows for the same person because one typed 01044175784 and
// the other +20 104 417 5784 would be a support problem the teacher cannot
// diagnose.
//
// Canonical form is international without the leading +: 201044175784.
// That is exactly what wa.me links require, which is the other reason to
// prefer it over the local 01… form students type.

const EGYPT_COUNTRY_CODE = '20';

// Egyptian mobile numbers are 01 followed by a carrier digit (0, 1, 2 or 5)
// and then 8 more digits — 11 digits locally, 12 with the country code.
const LOCAL_MOBILE = /^01[0125]\d{8}$/;
const INTERNATIONAL_MOBILE = /^201[0125]\d{8}$/;

/**
 * Normalizes an Egyptian mobile number to `201XXXXXXXXX`.
 * Returns null when the input is not a valid Egyptian mobile number.
 */
export function normalizeEgyptianPhone(input: string): string | null {
  if (!input) return null;

  // Strip everything a person might reasonably type as separators, plus the
  // leading + and any Arabic-Indic digits pasted from a phone keyboard.
  const digits = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^\d]/g, '');

  if (INTERNATIONAL_MOBILE.test(digits)) return digits;
  if (LOCAL_MOBILE.test(digits)) return EGYPT_COUNTRY_CODE + digits.slice(1);

  return null;
}

export function isValidEgyptianPhone(input: string): boolean {
  return normalizeEgyptianPhone(input) !== null;
}

/** `201044175784` -> `01044175784`, the form students recognise. */
export function toLocalEgyptianPhone(normalized: string): string {
  return normalized.startsWith(EGYPT_COUNTRY_CODE)
    ? '0' + normalized.slice(EGYPT_COUNTRY_CODE.length)
    : normalized;
}

/** Builds a wa.me deep link with an optional prefilled message. */
export function whatsappLink(normalizedPhone: string, message?: string): string {
  const base = `https://wa.me/${normalizedPhone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
