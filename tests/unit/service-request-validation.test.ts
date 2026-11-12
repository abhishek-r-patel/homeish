// Verify request form contracts reject invalid locations, attachments and assignments.
import { describe, expect, it } from 'vitest';
import {
  serviceRequestAssignInputSchema,
  serviceRequestCategoryInputSchema,
  serviceRequestCreateInputSchema,
  serviceRequestSettingsSchema,
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
      priority: 'normal',
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
