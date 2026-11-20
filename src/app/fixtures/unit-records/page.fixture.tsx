// Render synthetic admin unit records for local browser coverage only.
import { UnitRecordPanels } from '@/components/structure/unit-record-panels';

const unitId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';

export default async function UnitRecordsFixture({
  searchParams,
}: {
  searchParams: Promise<{ readOnly?: string }>;
}) {
  const { readOnly } = await searchParams;
  return (
    <main className="mx-auto grid max-w-content-wide gap-space-5 p-space-4">
      <h1 className="text-title">Unit 360: 301</h1>
      <UnitRecordPanels
        canWrite={!readOnly}
        unit={{ id: unitId, floor: 3, active: true, area_sqft: 900 }}
        records={{
          today: '2026-11-21',
          timezone: 'Asia/Kolkata',
          floor_version: '123456789012345678901234567890ab',
          floor_units: [
            { id: unitId, number: '301', row: 1, column: 1 },
            {
              id: 'a0d55fc3-0751-4b79-86c1-5b3e25942392',
              number: '302',
              row: null,
              column: null,
            },
          ],
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
    </main>
  );
}
