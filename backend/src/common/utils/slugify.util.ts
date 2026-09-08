// The naive version of this is `replace(/[^a-z0-9]+/g, '-')`, which is fine
// for English titles and catastrophic here: every
// Arabic title reduces to the empty string, so all 117 lectures would compete
// for the same empty slug and only the first would survive the unique index.
//
// Transliterating to Latin rather than percent-encoding the Arabic is a
// deliberate choice. A URL is only useful here if it survives being pasted
// into WhatsApp, and `/lectures/al-nahw-1` does that where
// `/lectures/%D8%A7%D9%84%D9%86%D8%AD%D9%88-1` becomes an unreadable smear
// that some clients truncate mid-escape.

const ARABIC_TO_LATIN: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'a', ٱ: 'a',
  ب: 'b', ت: 't', ث: 'th',
  ج: 'g', ح: 'h', خ: 'kh',
  د: 'd', ذ: 'dh',
  ر: 'r', ز: 'z',
  س: 's', ش: 'sh',
  ص: 's', ض: 'd',
  ط: 't', ظ: 'z',
  ع: 'a', غ: 'gh',
  ف: 'f', ق: 'q', ك: 'k',
  ل: 'l', م: 'm', ن: 'n',
  ه: 'h', ة: 'a',
  و: 'w', ؤ: 'w',
  ي: 'y', ى: 'a', ئ: 'y',
  ء: '',
  // Persian/Urdu letters occasionally pasted in from other keyboards.
  پ: 'p', چ: 'ch', ژ: 'zh', گ: 'g',
};

// Harakat and other combining marks carry no information in a URL.
const ARABIC_DIACRITICS = /[ً-ْٰـ]/g;

function arabicIndicToWestern(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function slugify(text: string): string {
  const transliterated = arabicIndicToWestern(String(text))
    .replace(ARABIC_DIACRITICS, '')
    .split('')
    .map((char) => ARABIC_TO_LATIN[char] ?? char)
    .join('');

  const slug = transliterated
    .normalize('NFKD')
    // Strip Latin accents so "Résumé" and "Resume" do not become two slugs.
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug;
}

/**
 * Builds a slug that does not collide with `existing`.
 *
 * Two lectures genuinely can share a title — "المحاضرة الأولى" exists once per
 * grade per term, and the incumbent has at least four of them — so collisions
 * are the normal case here, not an edge case.
 *
 * Falls back to a stable prefix when a title transliterates to nothing at all
 * (a title of pure punctuation or emoji), because an empty slug is never a
 * valid URL.
 */
export function uniqueSlug(title: string, existing: Iterable<string>, fallback = 'lecture'): string {
  const taken = new Set(existing);
  const base = slugify(title) || fallback;

  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
