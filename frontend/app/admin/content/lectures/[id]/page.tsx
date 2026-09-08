import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAdminLecture } from '@/lib/admin-api';
import { GRADE_LABELS_AR, type Grade } from '@/lib/grades';
import { PageHeader } from '../../../ui';
import { LectureEditor } from './LectureEditor';
import { ItemsManager } from './ItemsManager';

export const metadata: Metadata = { title: 'تحرير محاضرة' };

export default async function LectureEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lecture = await getAdminLecture(id);

  if (!lecture) notFound();

  return (
    <>
      <PageHeader
        title={lecture.titleAr}
        subtitle={`${GRADE_LABELS_AR[lecture.grade as Grade] ?? lecture.grade} · ${lecture.academicYear}`}
        action={
          <div className="flex gap-3 text-sm">
            {lecture.isPublished && (
              <Link href={`/lectures/${lecture.slug}`} className="text-brand hover:underline">
                معاينة
              </Link>
            )}
            <Link href="/admin/content" className="text-brand hover:underline">
              رجوع
            </Link>
          </div>
        }
      />

      <LectureEditor lecture={lecture} />
      <ItemsManager lectureId={lecture._id} items={lecture.items} />
    </>
  );
}
