// Review and update one society's Core Platform configuration.
import Link from 'next/link';
import {
  FirstAdminForm,
  DeveloperOnboardingForm,
  SocietyForm,
  SocietyStatusControl,
  CommitteeHistoryControl,
} from '@/components/developer/console-controls';
import { Card } from '@/components/ui/data-display';
import {
  getDeveloperSociety,
  getDeveloperOnboarding,
  getDeveloperCommitteeHistorySetting,
  societyStatusSchema,
} from '@/core/developer/console';
import { ErrorPanel } from '@/components/ui/feedback';
import { BulkImportControl } from '@/components/home/bulk-import';

export const metadata = {
  title: 'Society configuration | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

type SocietyDetailPageProps = {
  params: Promise<{ societyId: string }>;
};

export default async function SocietyDetailPage({
  params,
}: SocietyDetailPageProps) {
  const { societyId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      societyId,
    )
  ) {
    return (
      <ErrorPanel
        message="Check the society address and try again."
        title="Society not found"
      />
    );
  }
  const [society, onboarding, committeeHistoryEnabled] = await Promise.all([
    getDeveloperSociety(societyId),
    getDeveloperOnboarding(societyId),
    getDeveloperCommitteeHistorySetting(societyId),
  ]);
  const status = societyStatusSchema.safeParse(society.status);
  if (!status.success) {
    throw new Error('The society has an unsupported status.');
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <Link
          className="text-caption text-dev-label underline"
          href="/developer"
        >
          Back to societies
        </Link>
        <h1 className="text-title font-semibold">{society.name}</h1>
      </header>
      <Card
        title="Onboarding record"
        description="Developer-only agreement, contact, stage and read-only admin progress. Contact details are never copied into audit text."
      >
        <DeveloperOnboardingForm record={onboarding} societyId={society.id} />
      </Card>
      <Card
        title="Bulk import"
        description="Use the same atomic CSV flow as society administrators. These imports are audited as developer actions."
      >
        <div className="grid gap-space-5">
          {(
            [
              ['units', 'Units'],
              ['residents', 'Residents'],
              ['opening_dues', 'Opening dues'],
              ['vehicles', 'Vehicles'],
              ['staff', 'Staff'],
              ['assets', 'Assets'],
            ] as const
          ).map(([kind, title]) => (
            <section className="grid gap-space-3" key={kind}>
              <h3 className="text-body-strong">{title}</h3>
              <BulkImportControl
                auditHref="/developer/audit?run="
                kind={kind}
                societyId={society.id}
              />
            </section>
          ))}
        </div>
      </Card>
      <Card
        title="Society status"
        description="Suspension makes this society read-only. Archiving blocks access but keeps its data."
      >
        <SocietyStatusControl
          currentStatus={status.data}
          societyId={society.id}
        />
      </Card>
      <Card
        title="Committee change history"
        description="Admins always see their society history. Turn committee access on only when agreed for this society."
      >
        <CommitteeHistoryControl
          enabled={committeeHistoryEnabled}
          societyId={society.id}
        />
      </Card>
      <Card
        title="Society details"
        description="Changes are recorded in the platform audit log."
      >
        <SocietyForm initial={society} />
      </Card>
      <Card
        title="Modules"
        description="Turn features on or off for this society. Existing information is kept."
        action={
          <Link
            className="text-body-strong text-brand underline"
            href={`/developer/modules?societyId=${encodeURIComponent(society.id)}`}
          >
            Configure Modules
          </Link>
        }
      >
        <p className="text-body text-ink-muted">
          The Core Platform stays on. Other modules are off until enabled.
        </p>
      </Card>
      <Card
        title="First admin"
        description="Create the society's first admin invitation. No email is sent until the person requests a sign-in code."
      >
        <FirstAdminForm societyId={society.id} />
      </Card>
    </section>
  );
}
