import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAdminLecture, getAccessCodes } from '@/lib/admin-api';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { PageHeader } from '../../../ui';
import { LectureEditor } from './LectureEditor';
import { ItemsManager } from './ItemsManager';
import { LectureCodes } from './LectureCodes';

export const metadata: Metadata = { title: 'تحرير محاضرة' };

export default async function LectureEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lecture = await getAdminLecture(id);

  if (!lecture) notFound();

  // Only the count is needed here — the full list lives one click away on the
  // codes screen, and pulling a hundred rows to render one number would make
  // this page slower for no gain.
  const { pagination } = await getAccessCodes({ lectureId: id, status: 'unused', limit: 1 });

  return (
    <>
      <PageHeader
        title={lecture.titleAr}
        subtitle={`${GRADE_LABELS_AR[lecture.grade as Grade] ?? lecture.grade} · ${lecture.academicYear}`}
        action={
          <div className="flex gap-3 text-sm">
            {lecture.isPublished && (
              <Link href={`/lectures/${lecture.slug}`} className="text-link hover:underline">
                معاينة
              </Link>
            )}
            <Link href="/admin/content" className="text-link hover:underline">
              رجوع
            </Link>
          </div>
        }
      />

      <LectureEditor lecture={lecture} />
      <ItemsManager lectureId={lecture._id} items={lecture.items} />
      <LectureCodes
        lectureId={lecture._id}
        lectureTitle={lecture.titleAr}
        priceMinorUnits={lecture.priceMinorUnits}
        unusedCount={pagination.total}
        className="mt-8"
      />
    </>
  );
}
