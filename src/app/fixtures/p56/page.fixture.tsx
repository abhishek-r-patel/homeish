// Exercise P56 multi-flat place switching and the atomic CSV stepper with synthetic data.
'use client';

import { useState } from 'react';
import { ResidentShell } from '@/components/app-shells';
import { BulkImportControl } from '@/components/home/bulk-import';
import { LanguageProvider } from '@/components/language-provider';
import { Card } from '@/components/ui/data-display';

const SOCIETY_ID = 'c56ab6d1-0000-4000-8000-000000000001';
const FLAT_A = 'a56ab6d1-0000-4000-8000-000000000001';
const FLAT_B = 'b56ab6d1-0000-4000-8000-000000000001';

export default function P56Fixture() {
  const [selection, setSelection] = useState<string | null>(FLAT_A);
  const places = [
    {
      societyId: SOCIETY_ID,
      societyName: 'Synthetic Society',
      href: '/fixtures/p56',
      label: 'A-101 · My home',
      active: selection === FLAT_A,
      unitId: FLAT_A,
      allFlats: false,
    },
    {
      societyId: SOCIETY_ID,
      societyName: 'Synthetic Society',
      href: '/fixtures/p56',
      label: 'B-202 · My home',
      active: selection === FLAT_B,
      unitId: FLAT_B,
      allFlats: false,
    },
    {
      societyId: SOCIETY_ID,
      societyName: 'Synthetic Society',
      href: '/fixtures/p56',
      label: 'All my flats · My home',
      active: selection === null,
      unitId: null,
      allFlats: true,
    },
  ];
  return (
    <LanguageProvider initialLocale="en" mode="device">
      <ResidentShell
        activeSocietyId={SOCIETY_ID}
        places={places}
        societies={[{ id: SOCIETY_ID, name: 'Synthetic Society' }]}
        switchPlace={async ({ unitId = null }) => {
          setSelection(unitId);
          return { ok: true };
        }}
      >
        <section className="grid gap-space-5">
          <h1 className="text-title font-semibold">P56 workspace preview</h1>
          <p className="text-body-strong">
            Showing {places.find((place) => place.active)?.label}
          </p>
          <Card title="Import vehicles">
            <BulkImportControl
              kind="vehicles"
              previewAction={async () => ({
                ok: true,
                data: {
                  rows: [
                    {
                      rowNumber: 2,
                      unitId: FLAT_A,
                      membershipId: 'd56ab6d1-0000-4000-8000-000000000001',
                      vehicleType: 'car',
                      registrationNumber: 'KA01AB1234',
                      tagNumber: 'A-101-1',
                    },
                  ],
                  issues: [],
                },
              })}
              saveAction={async () => ({
                ok: true,
                data: 'e56ab6d1-0000-4000-8000-000000000001',
                message: 'Import saved. Every row was added together.',
              })}
            />
          </Card>
        </section>
      </ResidentShell>
    </LanguageProvider>
  );
}
