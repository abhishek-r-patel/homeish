// Verify staff registration and unit-scoped action payload validation.
import { describe, expect, it } from 'vitest';
import {
  residentStaffRegistrationSchema,
  staffAdminSaveSchema,
  staffDayBlockSchema,
  staffNoteSaveSchema,
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

  it('keeps employment details to society staff and ties exit date to Left', () => {
    const societyStaff = {
      ...profile,
      staffId: null,
      staffType: 'society',
      status: 'active',
      unitIds: [],
      department: 'Maintenance',
      employmentStatus: 'on_notice',
    };
    expect(staffAdminSaveSchema.safeParse(societyStaff).success).toBe(true);
    expect(
      staffAdminSaveSchema.safeParse({ ...societyStaff, staffType: 'domestic' })
        .success,
    ).toBe(false);
    expect(
      staffAdminSaveSchema.safeParse({
        ...societyStaff,
        employmentStatus: 'left',
      }).success,
    ).toBe(false);
    expect(
      staffAdminSaveSchema.safeParse({
        ...societyStaff,
        employmentStatus: 'left',
        joiningDate: '2026-02-01',
        exitDate: '2026-01-31',
      }).success,
    ).toBe(false);
    expect(
      staffAdminSaveSchema.safeParse({
        ...societyStaff,
        employmentStatus: 'left',
        exitDate: '2026-01-31',
      }).success,
    ).toBe(true);
  });

  it('requires the last-seen version when editing a staff note', () => {
    const note = {
      noteId: null,
      staffId: '00000000-0000-4000-8000-000000000001',
      noteDate: '2026-11-01',
      category: 'appraisal',
      rating: 4,
      note: 'Keeps the plant room tidy.',
      action: '',
      followUpDate: null,
      status: 'open',
      expectedUpdatedAt: null,
    };
    const created = staffNoteSaveSchema.safeParse(note);
    expect(created.success && created.data.action).toBe(null);
    expect(
      staffNoteSaveSchema.safeParse({
        ...note,
        noteId: '00000000-0000-4000-8000-000000000002',
      }).success,
    ).toBe(false);
    expect(staffNoteSaveSchema.safeParse({ ...note, rating: 6 }).success).toBe(
      false,
    );
  });
});
