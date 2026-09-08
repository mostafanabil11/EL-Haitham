import type { Grade } from './grades';

export type CurrentUser = {
  id: string;
  phone: string;
  phoneLocal: string;
  parentPhone: string;
  parentPhoneLocal: string;
  name: string;
  grade: Grade | null;
  email: string | null;
  role: 'student' | 'admin';
  createdAt: string;
};

export type PublicSettings = {
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
};

export type ApiError = {
  success: false;
  message: string;
  error?: string | { field: string; message: string }[];
  statusCode: number;
};

export type CatalogLecture = {
  _id: string;
  titleAr: string;
  slug: string;
  grade: Grade;
  academicYear: string;
  priceMinorUnits: number;
  description: string | null;
  coverImage: string | null;
  itemCount: number;
  totalDurationSeconds: number;
  publishedAt: string | null;
};

export type LectureOutlineItem = {
  id: string;
  titleAr: string;
  type: 'video' | 'pdf' | 'text' | 'live';
  videoDurationSeconds: number;
  isFreePreview: boolean;
  order: number;
  contentHtml: string | null;
};

export type LectureDetail = CatalogLecture & {
  term: { _id: string; titleAr: string } | null;
  items: LectureOutlineItem[];
};
