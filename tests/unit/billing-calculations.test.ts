import { describe, expect, it } from 'vitest';
import { calculatePerSqftPaise } from '../../src/core/billing/validation';

describe('calculatePerSqftPaise', () => {
  it('rounds exact decimal area calculations to the nearest paise, half up', () => {
    expect(calculatePerSqftPaise(1, '1.50', 'paise')).toBe(2);
    expect(calculatePerSqftPaise(1, '1.49', 'paise')).toBe(1);
    expect(calculatePerSqftPaise(1, '1.51', 'paise')).toBe(2);
  });

  it('rounds to the nearest rupee, half up', () => {
    expect(calculatePerSqftPaise(100, '1.49', 'rupee')).toBe(100);
    expect(calculatePerSqftPaise(100, '1.50', 'rupee')).toBe(200);
    expect(calculatePerSqftPaise(100, '2.49', 'rupee')).toBe(200);
    expect(calculatePerSqftPaise(100, '2.50', 'rupee')).toBe(300);
  });

  it('keeps large calculations exact within the safe money range', () => {
    expect(calculatePerSqftPaise(10001, '12345.67', 'paise')).toBe(123_469_046);
  });

  it.each([
    { ratePaise: 0, areaSqft: '10.00', rounding: 'paise' },
    { ratePaise: 100, areaSqft: '0', rounding: 'paise' },
    { ratePaise: 100, areaSqft: '1.001', rounding: 'paise' },
    { ratePaise: 100, areaSqft: '1000000.00', rounding: 'paise' },
    { ratePaise: 1, areaSqft: '0.01', rounding: 'rupee' },
  ] as const)(
    'rejects invalid or unrepresentable input $ratePaise $areaSqft $rounding',
    ({ ratePaise, areaSqft, rounding }) =>
      expect(() =>
        calculatePerSqftPaise(ratePaise, areaSqft, rounding),
      ).toThrow(RangeError),
  );
});
