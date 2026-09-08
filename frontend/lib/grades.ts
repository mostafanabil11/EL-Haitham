// Mirrors backend/src/common/constants/grades.ts. Kept in school order, not
// alphabetical — the incumbent's dropdown reads
// "ثالث اعدادي, ثالث ثانوي, اول ثانوي, ثاني ثانوي", which is sorted by string
// and feels wrong to anyone who has been to school.
export const GRADES = ['prep3', 'sec1', 'sec2', 'sec3'] as const;

export type Grade = (typeof GRADES)[number];

export const GRADE_LABELS_AR: Record<Grade, string> = {
  prep3: 'الثالث الإعدادي',
  sec1: 'الأول الثانوي',
  sec2: 'الثاني الثانوي',
  sec3: 'الثالث الثانوي',
};

export const GRADE_OPTIONS = GRADES.map((value) => ({
  value,
  label: GRADE_LABELS_AR[value],
}));
