// Show developer-only society usage counts without personal records.
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { getDeveloperUsageOverview } from '@/core/developer/console';
import { DeveloperUsageTable } from '@/components/developer/usage-table';
import { createRequestId } from '@/core/errors';
import { logUnexpectedError } from '@/core/logging/error-logger';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Usage overview | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

export default async function DeveloperUsagePage() {
  let rows;
  try {
    rows = await getDeveloperUsageOverview();
  } catch (error) {
    await logUnexpectedError(error, {
      requestId: createRequestId(),
      route: 'developer.usage',
      source: 'server',
    });
    return (
      <ErrorPanel
        message="Usage figures are unavailable. No zero values were substituted."
        title="Usage overview unavailable"
      />
    );
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Usage overview</h1>
        <p className="text-body text-surface/80">
          Counts from this Homeish copy only. No names, phones or flat numbers
          are returned.
        </p>
      </header>
      <Card title="Societies">
        <DeveloperUsageTable rows={rows} />
      </Card>
    </section>
  );
}
