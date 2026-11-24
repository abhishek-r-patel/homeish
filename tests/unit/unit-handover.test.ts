// Verify D-85 checklist, link and template boundary validation.
import { describe, expect, it } from 'vitest';
import {
  unitHandoverCreateInputSchema,
  unitHandoverItemsInputSchema,
  unitHandoverTemplateInputSchema,
} from '../../src/core/structure/handover-validation';

const id = '00000000-0000-4000-8000-000000000300';
const other = '00000000-0000-4000-8000-000000000301';

describe('unit handovers', () => {
  it('rejects duplicate template keys and accepts copied starter items', () => {
    expect(
      unitHandoverTemplateInputSchema.safeParse({
        items: [
          { key: 'keys', label: 'Keys' },
          { key: 'KEYS', label: 'Keys copy' },
        ],
        expectedVersion: 0,
        clientRequestId: id,
      }).success,
    ).toBe(false);
    expect(
      unitHandoverTemplateInputSchema.safeParse({
        items: [{ key: 'keys', label: 'Keys' }],
        expectedVersion: 0,
        clientRequestId: id,
      }).success,
    ).toBe(true);
  });

  it('requires matching link types for moves and transfer cases', () => {
    expect(
      unitHandoverCreateInputSchema.safeParse({
        unitId: id,
        eventType: 'owner_transfer',
        moveId: id,
        transferCaseId: null,
        handoverOn: '2026-11-23',
        note: '',
        partyMembershipIds: [id],
        clientRequestId: other,
      }).success,
    ).toBe(false);
    expect(
      unitHandoverCreateInputSchema.safeParse({
        unitId: id,
        eventType: 'standalone',
        moveId: null,
        transferCaseId: null,
        handoverOn: '2026-11-23',
        note: '',
        partyMembershipIds: [],
        clientRequestId: other,
      }).success,
    ).toBe(true);
  });

  it('requires one closed-list answer per item', () => {
    expect(
      unitHandoverItemsInputSchema.safeParse({
        handoverId: id,
        items: [
          { itemId: other, response: 'yes', note: '' },
          { itemId: other, response: 'no', note: '' },
        ],
        reason: '',
        expectedVersion: 1,
      }).success,
    ).toBe(false);
  });
});
