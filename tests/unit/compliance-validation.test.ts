// Verify accepted-risk compliance inputs stay factual and versioned.
import { describe, expect, it } from 'vitest';
import {
  complianceEntryInputSchema,
  dataCleanupRuleInputSchema,
} from '../../src/core/compliance/validation';

const id = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';

describe('compliance validation', () => {
  it('requires verified completion and reasoned edits without risk fields', () => {
    const base = {
      id: null,
      title: 'Annual filing',
      authority: 'Registrar acknowledgement',
      recurrence: 'yearly',
      dueDate: '2026-12-01',
      responsibleMembershipId: id,
      status: 'done',
      completedOn: null,
      evidenceVersionId: null,
      note: '',
      expectedVersion: null,
      reason: null,
      clientRequestId: id,
    };
    expect(complianceEntryInputSchema.safeParse(base).success).toBe(false);
    expect(
      complianceEntryInputSchema.safeParse({
        ...base,
        completedOn: '2026-11-20',
      }).success,
    ).toBe(true);
    expect(
      complianceEntryInputSchema.safeParse({
        ...base,
        completedOn: '2026-11-20',
        id,
        expectedVersion: 1,
      }).success,
    ).toBe(false);
    expect(
      complianceEntryInputSchema.safeParse({
        ...base,
        completedOn: '2026-11-20',
        riskScore: 90,
      }).success,
    ).toBe(false);
  });

  it('bounds permanent cleanup to one to twenty years', () => {
    const rule = {
      recordKind: 'compliance_entry',
      enabled: true,
      olderThanYears: 5,
      expectedVersion: null,
    };
    expect(dataCleanupRuleInputSchema.safeParse(rule).success).toBe(true);
    expect(
      dataCleanupRuleInputSchema.safeParse({
        ...rule,
        olderThanYears: 21,
      }).success,
    ).toBe(false);
  });
});
