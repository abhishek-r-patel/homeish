// Verify AMC date ordering, exact cost parsing and versioned visit corrections.
import { describe, expect, it } from 'vitest';
import {
  amcContractInputSchema,
  amcVisitInputSchema,
  amcSettingsSchema,
} from '../../src/core/amc/validation';
const id = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const contract = {
  contractId: null,
  predecessorId: null,
  assetLabel: 'Lift',
  vendorName: 'Vendor',
  vendorContact: 'Contact',
  startDate: '2026-11-15',
  endDate: '2027-11-14',
  costRupees: '123.45',
  paymentTerms: 'Annual',
  visitFrequency: 'Quarterly',
  documentPath: null,
  expectedUpdatedAt: null,
  clientRequestId: id,
};
describe('AMC validation', () => {
  it('rejects inverted contract dates and stale edit shapes while preserving exact costs', () => {
    expect(amcContractInputSchema.parse(contract).costRupees).toBe(12345);
    expect(
      amcContractInputSchema.parse({ ...contract, costRupees: '0.00' })
        .costRupees,
    ).toBe(0);
    expect(
      amcContractInputSchema.safeParse({ ...contract, endDate: '2026-11-14' })
        .success,
    ).toBe(false);
    expect(
      amcContractInputSchema.safeParse({ ...contract, contractId: id }).success,
    ).toBe(false);
  });
  it('requires a loaded version to correct a visit', () => {
    const visit = {
      contractId: id,
      visitId: null,
      visitDate: '2026-11-15',
      summary: 'Inspected',
      technician: 'Technician',
      documentPath: null,
      expectedUpdatedAt: null,
      clientRequestId: id,
    };
    expect(amcVisitInputSchema.safeParse(visit).success).toBe(true);
    expect(
      amcVisitInputSchema.safeParse({ ...visit, visitId: id }).success,
    ).toBe(false);
    expect(
      amcVisitInputSchema.safeParse({
        ...visit,
        visitId: id,
        expectedUpdatedAt: '2026-11-15T00:00:00Z',
      }).success,
    ).toBe(true);
  });
  it('rejects duplicate, fractional and nonpositive reminder thresholds', () => {
    for (const days of [[7, 7], [0], [-1], [1.5]])
      expect(amcSettingsSchema.safeParse({ reminder_days: days }).success).toBe(
        false,
      );
    expect(
      amcSettingsSchema.safeParse({ reminder_days: [60, 30, 7] }).success,
    ).toBe(true);
  });
});
