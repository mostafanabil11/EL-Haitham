import type { Metadata } from 'next';
import { getAnnouncements, getAdminLectures } from '@/lib/admin-api';
import { PageHeader, EmptyState } from '../ui';
import { AnnouncementManager } from './AnnouncementManager';

export const metadata: Metadata = { title: 'الإعلانات' };

export default async function AnnouncementsPage() {
  const [announcements, lectures] = await Promise.all([
    getAnnouncements(),
    getAdminLectures(),
  ]);

  return (
    <>
      <PageHeader
        title="الإعلانات"
        subtitle="رسالة قصيرة تظهر للطلاب في حساباتهم — لكل الطلاب، أو لصف واحد، أو لمشتركي محاضرة بعينها."
      />

      <AnnouncementManager announcements={announcements} lectures={lectures} />

      {announcements.length === 0 && (
        <div className="mt-6">
          <EmptyState>لا توجد إعلانات بعد.</EmptyState>
        </div>
      )}
    </>
  );
}
