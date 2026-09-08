// The four grades this teacher covers, in the order a student progresses
// through them. Ordering matters: the incumbent renders its grade dropdown
// alphabetically — ثالث اعدادي, ثالث ثانوي, اول ثانوي, ثاني ثانوي — which is
// not how anyone thinks about school years, and it makes the list feel wrong
// before a student has read a single word of it.
export const GRADES = ['prep3', 'sec1', 'sec2', 'sec3'] as const;

export type Grade = (typeof GRADES)[number];

export const GRADE_LABELS_AR: Record<Grade, string> = {
  prep3: 'الثالث الإعدادي',
  sec1: 'الأول الثانوي',
  sec2: 'الثاني الثانوي',
  sec3: 'الثالث الثانوي',
};

/** Grades in school order, ready to render as a select. */
export const GRADE_OPTIONS = GRADES.map((value) => ({
  value,
  label: GRADE_LABELS_AR[value],
}));
