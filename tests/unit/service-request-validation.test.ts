// Verify request form contracts reject invalid locations, attachments, assignments, ratings and daily checks.
import { describe, expect, it } from 'vitest';
import {
  serviceRequestAssignInputSchema,
  serviceRequestCategoryInputSchema,
  serviceRequestCreateInputSchema,
  serviceRequestLogInputSchema,
  serviceRequestRateInputSchema,
  serviceRequestRoundCheckInputSchema,
  serviceRequestSettingsSchema,
  serviceRequestTargetsInputSchema,
} from '../../src/core/service-requests/validation';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const unitId = '5a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const requestId = '6a696d6f-774c-41d1-ae47-6254d4a8f4cf';

describe('service request validation', () => {
  it('requires a unit only for unit-located requests and caps photo count', () => {
    const base = {
      categoryId: societyId,
      locationType: 'unit',
      unitId,
      description: 'The kitchen tap is leaking.',
      priority: 'medium',
      attachments: [],
      clientRequestId: requestId,
    };
    expect(serviceRequestCreateInputSchema.safeParse(base).success).toBe(true);
    expect(
      serviceRequestCreateInputSchema.safeParse({
        ...base,
        unitId: null,
      }).success,
    ).toBe(false);
    expect(
      serviceRequestCreateInputSchema.safeParse({
        ...base,
        locationType: 'common_area',
        unitId: null,
      }).success,
    ).toBe(true);
    expect(
      serviceRequestCreateInputSchema.safeParse({
        ...base,
        attachments: Array.from({ length: 4 }, () => ({
          path: `${societyId}/${requestId}/photo.jpg`,
        })),
      }).success,
    ).toBe(false);
  });

  it('requires a single member or a valid vendor assignment', () => {
    const base = {
      requestId,
      membershipId: societyId,
      vendorName: null,
      vendorPhone: null,
      note: null,
    };
    expect(serviceRequestAssignInputSchema.safeParse(base).success).toBe(true);
    expect(
      serviceRequestAssignInputSchema.safeParse({
        ...base,
        membershipId: null,
        vendorName: 'Plumbing Co.',
        vendorPhone: '+919999000000',
      }).success,
    ).toBe(true);
    expect(
      serviceRequestAssignInputSchema.safeParse({
        ...base,
        vendorName: 'Plumbing Co.',
        vendorPhone: '+919999000000',
      }).success,
    ).toBe(false);
    expect(
      serviceRequestAssignInputSchema.safeParse({
        ...base,
        membershipId: null,
        vendorName: 'Plumbing Co.',
        vendorPhone: null,
      }).success,
    ).toBe(false);
    expect(
      serviceRequestAssignInputSchema.safeParse({
        ...base,
        membershipId: null,
        vendorId: unitId,
      }).success,
    ).toBe(true);
    expect(
      serviceRequestAssignInputSchema.safeParse({ ...base, vendorId: unitId })
        .success,
    ).toBe(false);
  });

  it('requires a unit only for unit-located logged requests', () => {
    const base = {
      categoryId: societyId,
      locationType: 'common_area',
      unitId: null,
      description: 'Lobby light is off.',
      priority: 'high',
      intakeSource: 'phone',
      clientRequestId: requestId,
    };
    expect(serviceRequestLogInputSchema.safeParse(base).success).toBe(true);
    expect(
      serviceRequestLogInputSchema.safeParse({ ...base, unitId }).success,
    ).toBe(false);
  });

  it('accepts all three detailed scores or none of them', () => {
    const base = { requestId, rating: 4, comment: null };
    expect(serviceRequestRateInputSchema.safeParse(base).success).toBe(true);
    expect(
      serviceRequestRateInputSchema.safeParse({
        ...base,
        quality: 4,
        speed: 3,
        behaviour: 5,
      }).success,
    ).toBe(true);
    expect(
      serviceRequestRateInputSchema.safeParse({ ...base, quality: 4 }).success,
    ).toBe(false);
  });

  it('caps target days and allows clearing all targets', () => {
    const targets = { critical: 1, high: 2, medium: 5, low: 365 };
    expect(
      serviceRequestTargetsInputSchema.safeParse({
        categoryId: societyId,
        targets,
      }).success,
    ).toBe(true);
    expect(
      serviceRequestTargetsInputSchema.safeParse({
        categoryId: societyId,
        targets: null,
      }).success,
    ).toBe(true);
    expect(
      serviceRequestTargetsInputSchema.safeParse({
        categoryId: societyId,
        targets: { ...targets, low: 366 },
      }).success,
    ).toBe(false);
  });

  it('only lets an issue check raise or link a request', () => {
    const base = {
      pointId: societyId,
      result: 'ok',
      note: null,
      action: 'none',
      categoryId: null,
      priority: null,
      linkRequestId: null,
      clientRequestId: requestId,
    };
    const parse = (input: object) =>
      serviceRequestRoundCheckInputSchema.safeParse({ ...base, ...input })
        .success;
    expect(parse({})).toBe(true);
    expect(parse({ result: 'issue' })).toBe(false);
    expect(parse({ result: 'issue', note: 'Bulb fused' })).toBe(true);
    expect(
      parse({ action: 'raise', categoryId: societyId, priority: 'low' }),
    ).toBe(false);
    expect(
      parse({
        result: 'issue',
        note: 'Bulb fused',
        action: 'raise',
        categoryId: societyId,
        priority: 'low',
      }),
    ).toBe(true);
    expect(
      parse({ result: 'issue', note: 'Bulb fused', action: 'raise' }),
    ).toBe(false);
    expect(
      parse({
        result: 'issue',
        note: 'Bulb fused',
        action: 'link',
        linkRequestId: unitId,
        priority: 'low',
      }),
    ).toBe(false);
    expect(
      parse({
        result: 'issue',
        note: 'Bulb fused',
        action: 'link',
        linkRequestId: unitId,
      }),
    ).toBe(true);
  });

  it('keeps optimistic category timestamps paired with the category ID', () => {
    const base = {
      id: null,
      name: 'Electrical',
      slaHours: 24,
      sortOrder: 10,
      active: true,
      expectedUpdatedAt: null,
    };
    expect(serviceRequestCategoryInputSchema.safeParse(base).success).toBe(
      true,
    );
    expect(
      serviceRequestCategoryInputSchema.safeParse({
        ...base,
        id: societyId,
      }).success,
    ).toBe(false);
    expect(
      serviceRequestCategoryInputSchema.safeParse({
        ...base,
        slaHours: 0,
      }).success,
    ).toBe(false);
  });

  it('bounds the automatic close window', () => {
    expect(
      serviceRequestSettingsSchema.safeParse({ auto_close_days: 30 }).success,
    ).toBe(true);
    expect(
      serviceRequestSettingsSchema.safeParse({ auto_close_days: 31 }).success,
    ).toBe(false);
  });
});
