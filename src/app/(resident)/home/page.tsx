// Render the authorized resident home without turning access failures into empty data.
import { ResidentHome } from '@/components/home/resident-home';
import { HomeRealtimeRefresh } from '@/components/home/realtime-refresh';
import { ErrorPanel } from '@/components/ui/feedback';
import { AppError } from '@/core/errors';
import { getResidentHome, type ResidentHomeData } from '@/core/home/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Home | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentHomePage() {
  let data: ResidentHomeData;
  try {
    data = await getResidentHome();
  } catch (error) {
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      const locale = await getRequestLocale();
      return (
        <section className="grid gap-space-5">
          <h1 className="text-title font-semibold">
            {translateMessage(locale, 'Home')}
          </h1>
          <ErrorPanel
            message={translateMessage(
              locale,
              'An active resident membership is required to view this home. Contact your society administrator if you need help with your access.',
            )}
            title={translateMessage(locale, 'Home access is not available')}
          />
        </section>
      );
    }
    throw error;
  }

  return (
    <div className="grid gap-space-4">
      <HomeRealtimeRefresh
        deliveryEnabled={data.deliveryEnabled}
        nextResponseAt={data.snapshot.next_response_at}
        serverNow={data.snapshot.server_now}
        societyId={data.societyId}
        unitIds={data.snapshot.units.map(({ id }) => id)}
        userId={data.userId}
        visitorEnabled={data.visitorEnabled}
      />
      <ResidentHome
        outstanding={data.outstanding}
        shortcuts={data.shortcuts}
        snapshot={data.snapshot}
        suspended={data.suspended}
      />
    </div>
  );
}
