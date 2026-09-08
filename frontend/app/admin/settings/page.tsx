import type { Metadata } from 'next';
import { getAdminSettings } from '@/lib/admin-api';
import { PageHeader, EmptyState } from '../ui';
import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: 'الإعدادات' };

export default async function SettingsPage() {
  const settings = await getAdminSettings();

  if (!settings) {
    return (
      <>
        <PageHeader title="الإعدادات" />
        <EmptyState>تعذّر تحميل الإعدادات.</EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="الإعدادات"
        subtitle="بيانات الموقع ورقم واتساب الذي تصل عليه طلبات الاشتراك."
      />
      <SettingsForm settings={settings} />
    </>
  );
}
