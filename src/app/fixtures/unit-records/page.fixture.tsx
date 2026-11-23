// Render synthetic admin unit records for local browser coverage only.
import { UnitPlacement } from '@/components/structure/unit-placement';
import { UnitRecordPanels } from '@/components/structure/unit-record-panels';
import { UnitHandoverFixture } from './handover.fixture';
import {
  FIXTURE_UNIT_ID,
  fixtureLayout,
} from '../building-layout-designer/synthetic-layout';

export default async function UnitRecordsFixture({
  searchParams,
}: {
  searchParams: Promise<{ readOnly?: string; building?: string }>;
}) {
  const { readOnly, building } = await searchParams;
  const layout = fixtureLayout(building);
  return (
    <main className="mx-auto grid max-w-content-wide gap-space-5 p-space-4">
      <h1 className="text-title">Unit 360: 101</h1>
      <UnitPlacement
        key={layout.selected ?? 'none'}
        unitId={FIXTURE_UNIT_ID}
        placement={{
          block_id: layout.buildings[0]!.id,
          block: layout.buildings[0]!.name,
          level: 1,
          label: null,
          position: 1,
          duplex: false,
        }}
        layout={layout}
        canWrite={!readOnly}
      />
      <UnitRecordPanels
        canWrite={!readOnly}
        unit={{ id: FIXTURE_UNIT_ID, floor: 1, active: true, area_sqft: 900 }}
        records={{
          today: '2026-11-21',
          timezone: 'Asia/Kolkata',
          placement: null,
          admins: [
            {
              id: 'b0d55fc3-0751-4b79-86c1-5b3e25942392',
              name: 'Synthetic admin',
            },
          ],
          areas: [],
          followups: [],
        }}
      />
      <UnitHandoverFixture />
    </main>
  );
}
