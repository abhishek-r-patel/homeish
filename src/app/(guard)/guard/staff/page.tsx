// Show privacy-limited staff gate entry and exit controls.
import { Card } from '@/components/ui/data-display';
import {
  GateStaffCodeForm,
  GateStaffList,
  GateUnitSelector,
} from '@/components/staff/gate-controls';
import { getGateStaffWorkspace } from '@/core/staff/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage, type MessageValues } from '@/core/i18n/messages';

export const metadata = {
  title: 'Staff at the gate | Homeish',
  robots: { index: false, follow: false },
};

export default async function GuardStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: MessageValues) =>
    translateMessage(locale, source, values);
  const { unitId } = await searchParams;
  const workspace = await getGateStaffWorkspace(unitId);
  const selectedUnitId = workspace.unitId;

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {t('Gate · Handled by {name}', { name: workspace.guard.name })}
        </p>
        <h1 className="text-title font-semibold">{t('Domestic staff')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Check staff in and out at the destination unit. A staff member can have only one open gate attendance at a time.',
          )}
        </p>
      </header>

      <Card title={t('Select destination')}>
        {workspace.units.length ? (
          <GateUnitSelector
            selectedUnitId={workspace.unitId}
            units={workspace.units}
          />
        ) : (
          <p className="text-body text-ink-muted">
            {t('No active units are available.')}
          </p>
        )}
      </Card>

      {selectedUnitId ? (
        <>
          <Card
            description={t(
              'Enter the code from the staff member’s registration when they are not listed below.',
            )}
            title={t('Check in by code')}
          >
            <GateStaffCodeForm unitId={selectedUnitId} />
          </Card>
          <Card title={t('Staff linked to this unit')}>
            <GateStaffList
              staff={workspace.staff.map((member) => ({
                ...member,
                unitId: selectedUnitId,
              }))}
            />
          </Card>
        </>
      ) : null}
    </section>
  );
}
