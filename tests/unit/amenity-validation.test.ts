// Verify recurring schedule overlap, exact free/paid fees and versioned booking inputs.
import { describe, expect, it } from 'vitest';
import {
  amenityInputSchema,
  amenityBookingInputSchema,
} from '../../src/core/amenity/validation';
const id = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const amenity = {
  amenityId: null,
  name: 'Hall',
  capacity: 4,
  feeRupees: '0.00',
  rules: 'Clean up',
  active: true,
  slots: [{ weekday: 1, start: '09:00', end: '10:00' }],
  expectedUpdatedAt: null,
  clientRequestId: id,
};
describe('amenity validation', () => {
  it('accepts adjacent or different-weekday slots but rejects overlapping and inverted slots', () => {
    expect(
      amenityInputSchema.safeParse({
        ...amenity,
        slots: [...amenity.slots, { weekday: 1, start: '10:00', end: '11:00' }],
      }).success,
    ).toBe(true);
    expect(
      amenityInputSchema.safeParse({
        ...amenity,
        slots: [...amenity.slots, { weekday: 2, start: '09:00', end: '10:00' }],
      }).success,
    ).toBe(true);
    expect(
      amenityInputSchema.safeParse({
        ...amenity,
        slots: [...amenity.slots, { weekday: 1, start: '09:30', end: '11:00' }],
      }).success,
    ).toBe(false);
    expect(
      amenityInputSchema.safeParse({
        ...amenity,
        slots: [{ weekday: 1, start: '11:00', end: '10:00' }],
      }).success,
    ).toBe(false);
  });
  it('preserves exact optional fees and requires a loaded amenity version for editing', () => {
    expect(amenityInputSchema.parse(amenity).feeRupees).toBe(0);
    expect(
      amenityInputSchema.parse({ ...amenity, feeRupees: '123.45' }).feeRupees,
    ).toBe(12345);
    expect(
      amenityInputSchema.safeParse({ ...amenity, feeRupees: '1.001' }).success,
    ).toBe(false);
    expect(
      amenityInputSchema.safeParse({ ...amenity, amenityId: id }).success,
    ).toBe(false);
  });
  it('rejects missing rules acknowledgement, fractional guests and injected booking fields', () => {
    const booking = {
      amenityId: id,
      slotId: id,
      date: '2099-01-05',
      unitId: id,
      guestCount: 2,
      rulesAccepted: true,
      expectedUpdatedAt: '2026-11-15T00:00:00Z',
      clientRequestId: id,
    };
    expect(
      amenityBookingInputSchema.safeParse({
        ...booking,
        rulesAccepted: undefined,
      }).success,
    ).toBe(false);
    expect(
      amenityBookingInputSchema.safeParse({ ...booking, guestCount: 1.5 })
        .success,
    ).toBe(false);
    expect(
      amenityBookingInputSchema.safeParse({ ...booking, fee_paise: 0 }).success,
    ).toBe(false);
  });
});
