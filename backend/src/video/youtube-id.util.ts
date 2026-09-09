/**
 * Turns whatever the teacher pastes into a bare YouTube video id.
 *
 * He will paste whatever the YouTube app gave him — a share link, a browser
 * URL with a playlist and a timestamp hanging off it, sometimes the id alone.
 * Storing that raw would mean the embed URL inherits the tracking parameters,
 * and `?list=` in particular makes the player autoplay the *next* lecture in
 * whatever playlist it came from when this one ends.
 *
 * So the id is extracted once, on save, and only the id is stored.
 */

// 11 characters from YouTube's base64url alphabet. This is not documented as a
// guarantee, but it has held for the life of the platform and it is the only
// thing that distinguishes an id from a typo.
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

export function extractYouTubeId(input: string): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;

  // Already an id.
  if (ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    // A pasted link often arrives without a scheme ("youtu.be/abc"). Adding
    // one lets the URL parser do the rest rather than hand-rolling a regex
    // for every shape YouTube publishes.
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  // youtu.be/<id>
  if (url.hostname.toLowerCase().endsWith('youtu.be')) {
    const candidate = url.pathname.slice(1).split('/')[0];
    return ID_PATTERN.test(candidate) ? candidate : null;
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get('v');
  if (v && ID_PATTERN.test(v)) return v;

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
    const candidate = segments[1];
    return ID_PATTERN.test(candidate) ? candidate : null;
  }

  return null;
}

export function isYouTubeId(value: string): boolean {
  return ID_PATTERN.test(value?.trim() ?? '');
}
