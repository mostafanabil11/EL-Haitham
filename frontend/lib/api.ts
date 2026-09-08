import type { ApiError } from './types';

// Everything the browser calls goes through /api, which next.config.ts
// rewrites to the Nest backend. Same origin, so the session cookie rides
// along automatically and there is no CORS preflight.
const CLIENT_BASE = '/api';

export class ApiRequestError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// The backend returns validation failures as an array of {field, message}.
// Flattening them here means a form can show each message under its own input
// instead of dumping "Validation failed" at the top and leaving the student to
// guess which box is wrong — the single most common reason a signup is
// abandoned on a phone.
function extractFieldErrors(body: ApiError): Record<string, string> {
  if (!Array.isArray(body.error)) return {};
  return Object.fromEntries(body.error.map((e) => [e.field, e.message]));
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(CLIENT_BASE + path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body ?? {}) as ApiError;
    const fieldErrors = extractFieldErrors(err);

    // The backend's own validation banner is the English string
    // "Validation failed", which is the one piece of untranslated text a
    // student would ever see. The per-field messages underneath are already
    // Arabic and say something useful, so the banner just points at them.
    const message =
      Object.keys(fieldErrors).length > 0
        ? 'راجع البيانات المُدخلة بالأسفل.'
        : err.message || 'حدث خطأ غير متوقع. حاول مرة أخرى.';

    throw new ApiRequestError(message, res.status, fieldErrors);
  }

  return body as T;
}
