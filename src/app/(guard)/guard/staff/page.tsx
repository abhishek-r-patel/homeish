// Show privacy-limited staff gate entry and exit controls.
import { Card } from '@/components/ui/data-display';
import {
  GateStaffCodeForm,
  GateStaffList,
  GateUnitSelector,
} from '@/components/staff/gate-controls';
import { getGateStaffWorkspace } from '@/core/staff/operations';

export const metadata = {
  title: 'Staff at the gate | Homeish',
  robots: { index: false, follow: false },
};

export default async function GuardStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string }>;
}) {
  const { unitId } = await searchParams;
  const workspace = await getGateStaffWorkspace(unitId);
  const selectedUnitId = workspace.unitId;

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          Gate · Handled by {workspace.guard.name}
        </p>
        <h1 className="text-title font-semibold">Domestic staff</h1>
        <p className="text-body text-ink-muted">
          Check staff in and out at the destination unit. A staff member can
          have only one open gate attendance at a time.
        </p>
      </header>

      <Card title="Select destination">
        {workspace.units.length ? (
          <GateUnitSelector
            selectedUnitId={workspace.unitId}
            units={workspace.units}
          />
        ) : (
          <p className="text-body text-ink-muted">
            No active units are available.
          </p>
        )}
      </Card>

      {selectedUnitId ? (
        <>
          <Card
            description="Enter the code from the staff member’s registration when they are not listed below."
            title="Check in by code"
          >
            <GateStaffCodeForm unitId={selectedUnitId} />
          </Card>
          <Card title="Staff linked to this unit">
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
