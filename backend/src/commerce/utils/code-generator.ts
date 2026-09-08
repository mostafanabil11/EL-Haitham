import * as crypto from 'crypto';

// Characters that survive being read off a screen, typed into WhatsApp, and
// re-typed by a teenager on a phone keyboard.
//
// Excluded deliberately: 0/O, 1/I/L. Those four confusions account for most
// mistyped codes, and every one of them becomes a support message the teacher
// has to answer by hand. 31 characters is a rounder trade than squeezing in
// two more that generate work.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUP_SIZE = 4;
const GROUPS = 3;

/**
 * Generates a code like `K7HP-3XQM-9WTF`.
 *
 * 31^12 ≈ 7.9 x 10^17 possibilities. Brute-forcing one over HTTP is not a
 * realistic threat even before the redemption throttle — the throttle is there
 * for scripted attempts against *leaked* codes, not for guessing.
 */
export function generateCode(): string {
  const length = GROUP_SIZE * GROUPS;
  const out: string[] = [];

  // randomInt over the alphabet length rather than reducing a random byte mod
  // 31: 256 is not a multiple of 31, so the modulo would make the first four
  // characters of the alphabet very slightly likelier than the rest. The bias
  // is tiny and harmless here, but unbiased is free.
  for (let i = 0; i < length; i++) {
    out.push(ALPHABET[crypto.randomInt(ALPHABET.length)]);
  }

  return (out.join('').match(/.{1,4}/g) ?? []).join('-');
}

/**
 * Accepts what a student actually pastes: lowercase, missing dashes, extra
 * spaces, or a code copied with surrounding text trimmed off.
 *
 * Returns null when the input cannot be a code at all, so the caller can say
 * "that is not a valid code" without a database round trip.
 */
export function normalizeCode(input: string): string | null {
  if (!input) return null;

  const cleaned = input
    .toUpperCase()
    // Arabic-Indic digits, in case the code is typed on an Arabic keypad.
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^A-Z0-9]/g, '');

  if (cleaned.length !== GROUP_SIZE * GROUPS) return null;

  // A character outside the alphabet means a misread rather than a wrong code
  // — most often O typed for 0 or I for 1. Repairing it silently would be
  // guessing at which code they meant, so it is rejected, but the caller's
  // message can tell them which characters are never used.
  if (![...cleaned].every((c) => ALPHABET.includes(c))) return null;

  return (cleaned.match(/.{1,4}/g) ?? []).join('-');
}

export const CODE_ALPHABET = ALPHABET;
