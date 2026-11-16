// Exact metering arithmetic, usage flags and input rules shared by the screens and the database.
import { describe, expect, it } from 'vitest';
import {
  formatMeterValue,
  meteringChargePaise,
  meteringConsumption,
  meteringRatePaiseFromRupees,
  meteringUsageFlag,
} from '../../src/core/metering/presentation';
import {
  meteringMeterInputSchema,
  meteringReadingInputSchema,
  meteringReviewInputSchema,
  normaliseMeterValue,
} from '../../src/core/metering/validation';

const ID = '7f0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d';
const PHOTO = `${ID}/readings/${ID}/${ID}.jpg`;

function period(consumption: string, readings = 1, resets = 0) {
  return { month: '2026-01-01', consumption, readings, resets };
}
const unitMeter = { scope: 'unit' as const, unit_occupied: true };

describe('metering arithmetic', () => {
  it('computes consumption exactly and treats a lower reading as a zero-usage reset', () => {
    expect(meteringConsumption('1240.5', '1262.75')).toEqual({
      consumption: '22.25',
      isReset: false,
    });
    expect(meteringConsumption('0.1', '0.3')).toEqual({
      consumption: '0.2',
      isReset: false,
    });
    expect(meteringConsumption('310', '12')).toEqual({
      consumption: '0',
      isReset: true,
    });
    expect(meteringConsumption('5', '5')).toEqual({
      consumption: '0',
      isReset: false,
    });
  });

  it('rounds each charge half up to whole paise', () => {
    expect(meteringChargePaise('18.25', 850)).toBe(15513);
    expect(meteringChargePaise('0.001', 499)).toBe(0);
    expect(meteringChargePaise('0.001', 500)).toBe(1);
    expect(meteringChargePaise('999999.999', 10_000_000)).toBe(
      9_999_999_990_000,
    );
    expect(() => meteringChargePaise('1', 8.5)).toThrow(RangeError);
  });

  it('parses rupee rates and meter values without floating point drift', () => {
    expect(meteringRatePaiseFromRupees('8.50')).toBe(850);
    expect(meteringRatePaiseFromRupees('0.07')).toBe(7);
    expect(meteringRatePaiseFromRupees('8.505')).toBeNull();
    expect(meteringRatePaiseFromRupees('-1')).toBeNull();
    expect(normaliseMeterValue('1,240.500')).toBe('1240.5');
    expect(normaliseMeterValue('007')).toBe('7');
    expect(normaliseMeterValue('1.2345')).toBeNull();
    expect(normaliseMeterValue('-3')).toBeNull();
    expect(formatMeterValue('52.250')).toBe('52.25');
  });
});

describe('metering usage flags', () => {
  it('flags usage above twice the average of the previous three months', () => {
    const periods = [
      period('10'),
      period('10'),
      period('10'),
      period('20.001'),
    ];
    expect(meteringUsageFlag(unitMeter, periods, 3)).toBe('high');
    periods[3] = period('20');
    expect(meteringUsageFlag(unitMeter, periods, 3)).toBeNull();
  });

  it('needs three earlier months with readings and usage before flagging high', () => {
    expect(
      meteringUsageFlag(unitMeter, [period('1'), period('1'), period('9')], 2),
    ).toBeNull();
    expect(
      meteringUsageFlag(
        unitMeter,
        [period('1'), period('0', 0), period('1'), period('9')],
        3,
      ),
    ).toBeNull();
    expect(
      meteringUsageFlag(
        unitMeter,
        [period('0'), period('0'), period('0'), period('9')],
        3,
      ),
    ).toBeNull();
  });

  it('flags zero usage only on an occupied unit meter with a non-reset reading', () => {
    expect(meteringUsageFlag(unitMeter, [period('0')], 0)).toBe('zero');
    expect(meteringUsageFlag(unitMeter, [period('0', 1, 1)], 0)).toBeNull();
    expect(meteringUsageFlag(unitMeter, [period('0', 0)], 0)).toBeNull();
    expect(
      meteringUsageFlag(
        { ...unitMeter, unit_occupied: false },
        [period('0')],
        0,
      ),
    ).toBeNull();
    expect(
      meteringUsageFlag(
        { scope: 'common', unit_occupied: false },
        [period('0')],
        0,
      ),
    ).toBeNull();
  });
});

describe('metering input rules', () => {
  it('keeps unit meters on a unit and common-area meters off every unit', () => {
    const meter = {
      meterId: null,
      meterType: 'water',
      scope: 'common',
      unitId: null,
      label: 'Clubhouse',
      serialNumber: '',
      initialReading: '12.5',
      active: true,
      expectedVersion: null,
      clientRequestId: ID,
    };
    expect(meteringMeterInputSchema.parse(meter).initialReading).toBe('12.5');
    expect(
      meteringMeterInputSchema.safeParse({ ...meter, unitId: ID }).success,
    ).toBe(false);
    expect(
      meteringMeterInputSchema.safeParse({ ...meter, scope: 'unit' }).success,
    ).toBe(false);
  });

  it('accepts only private reading photo paths and 3-decimal values', () => {
    const reading = {
      meterId: ID,
      readingValue: '1262.750',
      readingDate: '2026-11-15',
      lowerReason: '',
      photoPath: PHOTO,
      clientRequestId: ID,
    };
    expect(meteringReadingInputSchema.parse(reading).readingValue).toBe(
      '1262.75',
    );
    expect(
      meteringReadingInputSchema.safeParse({
        ...reading,
        photoPath: `${ID}/reports/${ID}/${ID}.jpg`,
      }).success,
    ).toBe(false);
    expect(
      meteringReadingInputSchema.safeParse({
        ...reading,
        readingValue: '1.0001',
      }).success,
    ).toBe(false);
  });

  it('requires a reason to reject a reading but not to approve it', () => {
    expect(
      meteringReviewInputSchema.safeParse({
        readingId: ID,
        decision: 'approve',
        reason: '',
      }).success,
    ).toBe(true);
    expect(
      meteringReviewInputSchema.safeParse({
        readingId: ID,
        decision: 'reject',
        reason: '',
      }).success,
    ).toBe(false);
  });
});
