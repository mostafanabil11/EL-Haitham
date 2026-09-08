import { cookies } from 'next/headers';
import type { CurrentUser, PublicSettings, CatalogLecture, LectureDetail } from './types';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// Server-side calls talk to the backend directly and forward the caller's
// cookies by hand. Because the browser's cookies were set on THIS origin (see
// the rewrite in next.config.ts), next/headers can actually read them — which
// is what lets a page decide server-side whether someone may see its content,
// rather than rendering a shell and checking later in the browser.
async function serverFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const res = await fetch(API_URL + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data ?? body) as T;
  } catch {
    // A backend that is down must not throw a 500 page for a visitor.
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return serverFetch<CurrentUser>('/auth/profile');
}

export async function getPublicSettings(): Promise<PublicSettings | null> {
  const cookieStore = await cookies();
  void cookieStore;
  try {
    const res = await fetch(API_URL + '/settings/public', { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as PublicSettings;
  } catch {
    return null;
  }
}

// The catalogue is public, so these need no cookies — which means they can be
// cached and revalidated rather than forcing a dynamic render on every visit.
// This is what makes the lecture pages indexable and fast at the same time.
export async function getCatalog(params: {
  grade?: string;
  limit?: number;
} = {}): Promise<{ lectures: CatalogLecture[]; total: number }> {
  const query = new URLSearchParams();
  if (params.grade) query.set('grade', params.grade);
  if (params.limit) query.set('limit', String(params.limit));

  try {
    const res = await fetch(`${API_URL}/catalog/lectures?${query}`, { next: { revalidate: 60 } });
    if (!res.ok) return { lectures: [], total: 0 };
    const body = await res.json();
    return { lectures: body.data ?? [], total: body.pagination?.total ?? 0 };
  } catch {
    return { lectures: [], total: 0 };
  }
}

export async function getLecture(slug: string): Promise<LectureDetail | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/lectures/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as LectureDetail;
  } catch {
    return null;
  }
}

export type MyEnrollment = {
  id: string;
  lecture: {
    _id: string;
    titleAr: string;
    slug: string;
    grade: string;
    itemCount: number;
    totalDurationSeconds: number;
  } | null;
  grantedAt: string;
  expiresAt: string | null;
  isExpired: boolean;
};

export async function getMyEnrollments(): Promise<MyEnrollment[]> {
  const data = await serverFetch<MyEnrollment[]>('/enrollments/mine');
  return data ?? [];
}

import type { LearnItem } from '@/app/learn/[slug]/LearnClient';

export type LearnLecture = {
  _id: string;
  titleAr: string;
  slug: string;
  grade: string;
  hasAccess: boolean;
  items: LearnItem[];
};

// Cookies are forwarded, so the API decides per-viewer what is unlocked and
// this page never has to reason about entitlement itself.
export async function getLearnLecture(slug: string): Promise<LearnLecture | null> {
  return serverFetch<LearnLecture>(`/learn/lectures/${encodeURIComponent(slug)}`);
}

export type StudentAnnouncement = {
  _id: string;
  titleAr: string;
  bodyAr: string;
  audience: 'all' | 'grade' | 'lecture';
  lecture: { _id: string; titleAr: string; slug: string } | null;
  isPinned: boolean;
  publishedAt: string | null;
};

export async function getMyAnnouncements(): Promise<StudentAnnouncement[]> {
  const data = await serverFetch<StudentAnnouncement[]>('/announcements/mine');
  return data ?? [];
}
