// Verify staff registration and unit-scoped action payload validation.
import { describe, expect, it } from 'vitest';
import {
  residentStaffRegistrationSchema,
  staffDayBlockSchema,
  staffProfileSchema,
} from '../../src/core/staff/validation';

const profile = {
  fullName: 'Asha Devi',
  phone: '+911234567890',
  photoPath: null,
  idType: null,
  idLastFour: null,
  jobRole: 'Cook',
  policeVerified: false,
};

describe('staff validation', () => {
  it('requires a valid unit and idempotency key for resident registration', () => {
    const registration = {
      ...profile,
      unitId: '00000000-0000-4000-8000-000000000001',
      requestId: '00000000-0000-4000-8000-000000000002',
    };
    expect(
      residentStaffRegistrationSchema.safeParse(registration).success,
    ).toBe(true);
    expect(
      residentStaffRegistrationSchema.safeParse({
        ...registration,
        requestId: 'invalid',
      }).success,
    ).toBe(false);
  });

  it('requires ID type and last four characters together', () => {
    expect(
      staffProfileSchema.safeParse({
        ...profile,
        idType: 'aadhaar',
      }).success,
    ).toBe(false);
    expect(
      staffProfileSchema.safeParse({
        ...profile,
        idType: 'aadhaar',
        idLastFour: '1234',
      }).success,
    ).toBe(true);
  });

  it('accepts a unit-specific block and rejects extra scope fields', () => {
    const block = {
      staffId: '00000000-0000-4000-8000-000000000001',
      unitId: '00000000-0000-4000-8000-000000000002',
    };
    expect(staffDayBlockSchema.safeParse(block).success).toBe(true);
    expect(
      staffDayBlockSchema.safeParse({ ...block, societyWide: true }).success,
    ).toBe(false);
  });
});
