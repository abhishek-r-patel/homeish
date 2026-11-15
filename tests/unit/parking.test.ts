// Parking validation and presentation rules that the database also enforces.
import { describe, expect, it } from 'vitest';
import {
  normalizeVehicleNumber,
  parkingPassInputSchema,
  parkingReportInputSchema,
  parkingSettingsInputSchema,
  parkingSlotInputSchema,
} from '../../src/core/parking/validation';
import {
  parkingPassEnd,
  parkingPassState,
  parkingQueueText,
} from '../../src/core/parking/presentation';

const UNIT = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const SLOT = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const REQUEST_ID = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';

function pass(startsAt: string, endsAt: string) {
  return parkingPassInputSchema.safeParse({
    unitId: UNIT,
    slotId: null,
    startsAt,
    endsAt,
    visitorName: 'Ravi',
    vehicleNumber: ' mh-01 ab 1234 ',
    visitorEntryId: null,
    clientRequestId: REQUEST_ID,
  });
}

describe('parking validation', () => {
  it('normalises vehicle numbers like the database', () => {
    expect(normalizeVehicleNumber(' mh-01 ab 1234 ')).toBe('MH01AB1234');
    expect(pass('2026-11-16T10:00:00Z', '2026-11-16T12:00:00Z').data).toEqual(
      expect.objectContaining({ vehicleNumber: 'MH01AB1234' }),
    );
  });

  it('accepts passes up to 24 hours and rejects longer or reversed windows', () => {
    expect(pass('2026-11-16T10:00:00Z', '2026-11-17T10:00:00Z').success).toBe(
      true,
    );
    expect(
      pass('2026-11-16T10:00:00Z', '2026-11-17T10:01:00Z').error?.issues[0]
        ?.message,
    ).toBe('A visitor pass can last at most 24 hours.');
    expect(
      pass('2026-11-16T10:00:00Z', '2026-11-16T10:00:00Z').error?.issues[0]
        ?.message,
    ).toBe('Choose an end time after the start time.');
  });

  it('keeps photo retention between 1 and 90 days', () => {
    for (const [days, ok] of [
      [0, false],
      [1, true],
      [90, true],
      [91, false],
    ] as const) {
      expect(
        parkingSettingsInputSchema.safeParse({ photoRetentionDays: days })
          .success,
      ).toBe(ok);
    }
  });

  it('needs a slot or a vehicle number for a wrong-parking report', () => {
    const base = {
      slotId: null,
      vehicleNumber: '  ',
      note: null,
      photoPath: null,
      clientRequestId: REQUEST_ID,
    };
    expect(parkingReportInputSchema.safeParse(base).success).toBe(false);
    expect(
      parkingReportInputSchema.safeParse({ ...base, slotId: SLOT }).success,
    ).toBe(true);
    expect(
      parkingReportInputSchema.safeParse({ ...base, vehicleNumber: 'KA05X1' })
        .success,
    ).toBe(true);
  });

  it('requires a version only when editing an existing slot', () => {
    const slot = {
      label: 'B-12',
      slotType: 'car',
      locationNote: null,
      clientRequestId: REQUEST_ID,
    };
    expect(
      parkingSlotInputSchema.safeParse({
        ...slot,
        slotId: null,
        expectedVersion: null,
      }).success,
    ).toBe(true);
    expect(
      parkingSlotInputSchema.safeParse({
        ...slot,
        slotId: SLOT,
        expectedVersion: null,
      }).success,
    ).toBe(false);
    expect(
      parkingSlotInputSchema.safeParse({
        ...slot,
        slotId: SLOT,
        expectedVersion: 2,
      }).success,
    ).toBe(true);
  });
});

describe('parking presentation', () => {
  it('derives pass ends within the 24-hour limit', () => {
    expect(parkingPassEnd('2026-11-16T10:00:00.000Z', 24)).toBe(
      '2026-11-17T10:00:00.000Z',
    );
    expect(() => parkingPassEnd('2026-11-16T10:00:00.000Z', 25)).toThrow(
      RangeError,
    );
  });

  it('describes pass state and queue position', () => {
    const now = Date.parse('2026-11-16T12:00:00Z');
    const window = {
      status: 'active' as const,
      starts_at: '2026-11-16T10:00:00Z',
      ends_at: '2026-11-16T14:00:00Z',
    };
    expect(parkingPassState(window, now)).toBe('current');
    expect(
      parkingPassState({ ...window, starts_at: '2026-11-16T13:00:00Z' }, now),
    ).toBe('upcoming');
    expect(
      parkingPassState({ ...window, ends_at: '2026-11-16T12:00:00Z' }, now),
    ).toBe('ended');
    expect(parkingPassState({ ...window, status: 'cancelled' }, now)).toBe(
      'cancelled',
    );
    expect(parkingQueueText(1)).toBe('Next in line');
    expect(parkingQueueText(3)).toBe('Number 3 in line');
    expect(parkingQueueText(null)).toBeNull();
  });
});
