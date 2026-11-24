// Verify official case dates, closure and corrections stay factual.
import { describe, expect, it } from 'vitest';
import { officialCaseInputSchema } from '../../src/core/document/official-cases-validation';

const id = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const base = {
  id: null,
  authority: 'Registrar',
  reference: 'REF-1',
  subject: 'Factual correspondence',
  relevantPeriod: '2026-27',
  receivedOn: '2026-11-01',
  filedOn: null,
  filingMode: null,
  filingAcknowledgement: null,
  replyDueOn: '2026-12-01',
  hearingOn: null,
  responseOn: null,
  status: 'open',
  reviewerMembershipId: null,
  complianceEntryId: null,
  closedOn: null,
  note: '',
  expectedVersion: null,
  reason: null,
  clientRequestId: id,
};

describe('official case validation', () => {
  it('requires a closure date and reason for edited cases', () => {
    expect(officialCaseInputSchema.safeParse(base).success).toBe(true);
    expect(
      officialCaseInputSchema.safeParse({ ...base, status: 'closed' }).success,
    ).toBe(false);
    expect(
      officialCaseInputSchema.safeParse({
        ...base,
        id,
        expectedVersion: 1,
        reason: null,
      }).success,
    ).toBe(false);
    expect(
      officialCaseInputSchema.safeParse({
        ...base,
        id,
        expectedVersion: 1,
        reason: 'Verified source changed',
      }).success,
    ).toBe(true);
  });
});
