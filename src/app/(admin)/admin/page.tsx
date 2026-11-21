// Render the admin and committee dashboard (A-01), streaming its data behind a skeleton.
import { Suspense } from 'react';
import { AdminHome } from '@/components/home/admin-home';
import { ErrorPanel, Skeleton } from '@/components/ui/feedback';
import { AppError } from '@/core/errors';
import { getAdminHome, type AdminHomeData } from '@/core/home/admin-operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Dashboard | Homeish',
  robots: { index: false, follow: false },
};

async function AdminHomeContent() {
  let data: AdminHomeData;
  try {
    data = await getAdminHome();
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'FORBIDDEN' || error.code === 'SOCIETY_ARCHIVED')
    ) {
      const locale = await getRequestLocale();
      return (
        <section className="grid gap-space-5">
          <h1 className="text-title font-semibold">
            {translateMessage(locale, 'Dashboard')}
          </h1>
          <ErrorPanel
            message={translateMessage(
              locale,
              error.code === 'FORBIDDEN'
                ? 'An active admin or committee membership is required to view the dashboard.'
                : 'This society is archived, so its dashboard is no longer available.',
            )}
            title={translateMessage(locale, 'Dashboard is not available')}
          />
        </section>
      );
    }
    throw error;
  }
  return <AdminHome {...data} />;
}

export default async function AdminDashboardPage() {
  const locale = await getRequestLocale();
  return (
    <Suspense
      fallback={
        <Skeleton
          label={translateMessage(locale, 'Loading dashboard')}
          rows={8}
        />
      }
    >
      <AdminHomeContent />
    </Suspense>
  );
}
