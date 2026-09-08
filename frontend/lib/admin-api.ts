import { cookies } from 'next/headers';
import type { Grade } from './grades';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// --- Response shapes -------------------------------------------------------

export type Paginated<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type AdminOverview = {
  students: { total: number; newThisMonth: number };
  activeEnrollments: number;
  pendingRequests: number;
  unusedCodes: number;
  publishedLectures: number;
  revenueThisMonth: { minorUnits: number; confirmedRequests: number };
  mostWatched: {
    id: string;
    titleAr: string;
    slug: string;
    grade: Grade;
    watchers: number;
    seconds: number;
  }[];
  oldestPending: PurchaseRequestRow[];
};

export type RequestStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export type PurchaseRequestRow = {
  _id: string;
  requestNumber: string;
  user: { _id: string; name: string; phone: string; parentPhone?: string; grade?: Grade } | null;
  targetKind: 'lecture' | 'bundle';
  priceMinorUnits: number;
  titleSnapshot: string;
  phone: string;
  status: RequestStatus;
  paidAt: string | null;
  issuedCode: { _id: string; code: string; status: string } | null;
  adminNote: string | null;
  createdAt: string;
};

export type CodeStatus = 'unused' | 'redeemed' | 'revoked';

export type AccessCodeRow = {
  _id: string;
  code: string;
  targetKind: 'lecture' | 'bundle';
  lecture: { _id: string; titleAr: string; slug: string } | null;
  bundle: { _id: string; titleAr: string; slug: string } | null;
  status: CodeStatus;
  redeemedBy: { _id: string; name: string; phone: string } | null;
  redeemedAt: string | null;
  expiresAt: string | null;
  batchId: string | null;
  note: string | null;
  createdAt: string;
};

export type StudentRow = {
  _id: string;
  name: string;
  phone: string;
  parentPhone: string;
  grade: Grade | null;
  email: string | null;
  role: 'student' | 'admin';
  isActive: boolean;
  createdAt: string;
};

export type StudentDetail = {
  student: StudentRow;
  enrollments: {
    _id: string;
    lecture: { _id: string; titleAr: string; slug: string; grade: Grade } | null;
    source: string;
    grantedAt: string;
    expiresAt: string | null;
    isActive: boolean;
    isExpired: boolean;
  }[];
  codes: AccessCodeRow[];
  requests: PurchaseRequestRow[];
  progress: {
    _id: string;
    lecture: { _id: string; titleAr: string; slug: string } | null;
    lastPositionSeconds: number;
    furthestSeconds: number;
    completedAt: string | null;
    updatedAt: string;
  }[];
  lastActiveAt: string | null;
};

export type AdminLecture = {
  _id: string;
  titleAr: string;
  slug: string;
  grade: Grade;
  academicYear: string;
  priceMinorUnits: number;
  isPublished: boolean;
  isArchived: boolean;
  itemCount: number;
  totalDurationSeconds: number;
  order: number;
  term: string | { _id: string; titleAr: string } | null;
};

// --- Fetching --------------------------------------------------------------

/**
 * Admin reads happen on the server, with the caller's own cookie forwarded.
 *
 * That matters beyond convenience: the browser never receives an admin token
 * it could leak, and a non-admin who guesses a URL gets a 403 from the API
 * *and* a redirect from the layout, rather than an empty shell that briefly
 * renders the admin chrome before discovering it has no data.
 */
async function adminFetch<T>(path: string): Promise<{ data: T; pagination?: Paginated<T>['pagination'] } | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const res = await fetch(API_URL + path, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = await res.json();
    return { data: body.data as T, pagination: body.pagination };
  } catch {
    return null;
  }
}

function paginated<T>(
  result: { data: T[]; pagination?: Paginated<T>['pagination'] } | null,
  limit: number,
): Paginated<T> {
  return {
    items: result?.data ?? [],
    pagination: result?.pagination ?? { page: 1, limit, total: 0, pages: 0 },
  };
}

export async function getOverview(): Promise<AdminOverview | null> {
  const result = await adminFetch<AdminOverview>('/admin/overview');
  return result?.data ?? null;
}

export async function getPurchaseRequests(params: {
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<PurchaseRequestRow>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  const limit = params.limit ?? 30;
  query.set('limit', String(limit));

  return paginated(await adminFetch<PurchaseRequestRow[]>(`/admin/purchase-requests?${query}`), limit);
}

export async function getAccessCodes(params: {
  status?: string;
  batchId?: string;
  lectureId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<AccessCodeRow>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.batchId) query.set('batchId', params.batchId);
  if (params.lectureId) query.set('lectureId', params.lectureId);
  if (params.page) query.set('page', String(params.page));
  const limit = params.limit ?? 50;
  query.set('limit', String(limit));

  return paginated(await adminFetch<AccessCodeRow[]>(`/admin/access-codes?${query}`), limit);
}

export async function getStudents(params: {
  q?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<StudentRow>> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));
  const limit = params.limit ?? 20;
  query.set('limit', String(limit));

  return paginated(await adminFetch<StudentRow[]>(`/admin/students?${query}`), limit);
}

export async function getStudent(id: string): Promise<StudentDetail | null> {
  const result = await adminFetch<StudentDetail>(`/admin/students/${encodeURIComponent(id)}`);
  return result?.data ?? null;
}

export async function getAdminLectures(params: {
  includeArchived?: boolean;
  grade?: string;
} = {}): Promise<AdminLecture[]> {
  const query = new URLSearchParams();
  if (params.includeArchived) query.set('includeArchived', 'true');
  if (params.grade) query.set('grade', params.grade);

  // Deliberately no `limit`. The admin listing is unpaginated server-side, and
  // the query DTO it shares with the public catalogue caps `limit` at 60 — so
  // sending one large enough for a full year (117 lectures in the incumbent)
  // fails validation and silently empties the list.
  const result = await adminFetch<AdminLecture[]>(`/admin/content/lectures?${query}`);
  return result?.data ?? [];
}

export type AdminTerm = {
  _id: string;
  titleAr: string;
  grade: Grade;
  academicYear: string;
  order: number;
  isArchived: boolean;
};

export type LectureItemType = 'video' | 'pdf' | 'text' | 'live';

export type AdminLectureItem = {
  _id: string;
  titleAr: string;
  type: LectureItemType;
  videoAssetId: string | null;
  videoDurationSeconds: number;
  contentHtml: string | null;
  attachments: { name: string; key: string; sizeBytes?: number; mimeType?: string | null }[];
  isFreePreview: boolean;
  order: number;
};

export type AdminLectureDetail = AdminLecture & {
  description: string | null;
  coverImage: string | null;
  accessDurationDays: number | null;
  publishedAt: string | null;
  items: AdminLectureItem[];
};

export async function getAdminTerms(includeArchived = false): Promise<AdminTerm[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  const result = await adminFetch<AdminTerm[]>(`/admin/content/terms${query}`);
  return result?.data ?? [];
}

export async function getAdminLecture(id: string): Promise<AdminLectureDetail | null> {
  const result = await adminFetch<AdminLectureDetail>(
    `/admin/content/lectures/${encodeURIComponent(id)}`,
  );
  return result?.data ?? null;
}

export type AdminSettings = {
  siteName: string;
  tagline: string | null;
  teacherName: string | null;
  teacherBio: string | null;
  teacherPhoto: string | null;
  logo: string | null;
  heroImage: string | null;
  whatsappNumber: string | null;
  socialLinks: {
    facebook: string | null;
    youtube: string | null;
    tiktok: string | null;
    instagram: string | null;
  };
  isRegistrationOpen: boolean;
  currency: string;
  defaultAccessDurationDays: number | null;
  currentAcademicYear: string;
  purchaseRequestExpiryHours: number;
};

export async function getAdminSettings(): Promise<AdminSettings | null> {
  const result = await adminFetch<AdminSettings>('/settings');
  return result?.data ?? null;
}

export type ReportLine = {
  lectureId: string;
  titleAr: string;
  percentWatched: number;
  isComplete: boolean;
  hasStarted: boolean;
  activeThisPeriod: boolean;
};

export type StudentReport = {
  studentId: string;
  name: string;
  grade: string | null;
  phoneLocal: string;
  parentPhoneLocal: string;
  periodLabel: string;
  lectures: ReportLine[];
  lectureCount: number;
  completedCount: number;
  startedCount: number;
  averagePercent: number;
  lastActiveAt: string | null;
  message: string;
  whatsappUrl: string | null;
};

export async function getReports(params: {
  month?: string;
  q?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<StudentReport>> {
  const query = new URLSearchParams();
  if (params.month) query.set('month', params.month);
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));
  const limit = params.limit ?? 20;
  query.set('limit', String(limit));

  return paginated(await adminFetch<StudentReport[]>(`/admin/reports?${query}`), limit);
}

export async function getStudentReport(
  id: string,
  month?: string,
): Promise<StudentReport | null> {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  const result = await adminFetch<StudentReport>(
    `/admin/students/${encodeURIComponent(id)}/report${query}`,
  );
  return result?.data ?? null;
}
