// Exercise D-85 unit handover forms without hosted writes.
'use client';
import type { ZodType } from 'zod';
import { UnitHandoversPanel } from '@/components/structure/unit-handovers';
import type { UnitHandoverPayloadAction } from '@/components/structure/handover-forms';
import {
  unitHandoverCreateInputSchema,
  unitHandoverItemsInputSchema,
  unitHandoverReadingInputSchema,
  unitHandoverTemplateInputSchema,
  type UnitHandoverWorkspace,
} from '@/core/structure/handover-validation';
import { FIXTURE_UNIT_ID } from '../building-layout-designer/synthetic-layout';

function accept(schema: ZodType, message: string): UnitHandoverPayloadAction {
  return async (_unitId, payload) => {
    const parsed = schema.safeParse(payload);
    return parsed.success
      ? { ok: true, message }
      : {
          ok: false,
          code: 'VALIDATION_FAILED',
          message: parsed.error.issues[0]?.message ?? 'Invalid.',
        };
  };
}

const handoverId = '00000000-0000-4000-8000-000000000201';
const itemId = '00000000-0000-4000-8000-000000000202';
const workspace: UnitHandoverWorkspace = {
  can_manage: true,
  today: '2026-11-23',
  template: {
    items: [{ key: 'keys', label: 'Keys' }],
    version: 1,
    updated_at: '2026-11-23T00:00:00.000Z',
  },
  parties: [
    {
      membership_id: '00000000-0000-4000-8000-000000000203',
      name: 'Synthetic Resident',
      role: 'owner',
    },
  ],
  moves: [],
  transfer_cases: [],
  readings: [
    {
      id: '00000000-0000-4000-8000-000000000204',
      meter_type: 'Water',
      reading_value: 1500,
      reading_date: '2026-11-20',
    },
  ],
  handovers: [
    {
      id: handoverId,
      event_type: 'standalone',
      move_id: null,
      transfer_case_id: null,
      handover_on: '2026-11-23',
      status: 'open',
      note: 'Synthetic condition handover',
      version: 1,
      closed_at: null,
      created_at: '2026-11-23T00:00:00.000Z',
      items: [
        {
          id: itemId,
          position: 1,
          item_key: 'keys',
          label: 'Keys',
          response: null,
          note: null,
        },
      ],
      parties: [
        {
          membership_id: '00000000-0000-4000-8000-000000000203',
          name: 'Synthetic Resident',
          role: 'owner',
          acknowledged_at: null,
          acknowledgement_note: null,
        },
      ],
      readings: [],
      photos: [],
      can_acknowledge: false,
    },
  ],
};

export function UnitHandoverFixture() {
  return (
    <UnitHandoversPanel
      unitId={FIXTURE_UNIT_ID}
      workspace={workspace}
      actions={{
        template: accept(
          unitHandoverTemplateInputSchema,
          'Handover checklist saved.',
        ),
        create: accept(unitHandoverCreateInputSchema, 'Unit handover created.'),
        items: accept(
          unitHandoverItemsInputSchema,
          'Handover checklist saved.',
        ),
        reading: accept(
          unitHandoverReadingInputSchema,
          'Meter reading linked.',
        ),
      }}
    />
  );
}
