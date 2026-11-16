// Cover the meeting quorum rule and India-time notice-period counting.
import { describe, expect, it } from 'vitest';
import { computeQuorum, noticeCheck } from '../../src/core/meeting/quorum';

describe('computeQuorum', () => {
  it('meets quorum exactly at the threshold', () => {
    expect(computeQuorum(100, 33, 33)).toMatchObject({ met: true, needed: 33 });
    expect(computeQuorum(100, 32, 33)).toMatchObject({
      met: false,
      needed: 33,
    });
  });

  it('rounds the needed count up for fractional thresholds', () => {
    expect(computeQuorum(10, 3, 33)).toMatchObject({ met: false, needed: 4 });
    expect(computeQuorum(10, 4, 33).met).toBe(true);
    expect(computeQuorum(3, 2, 50)).toMatchObject({ met: true, needed: 2 });
  });

  it('never meets quorum when nobody is invited or no percent is set', () => {
    expect(computeQuorum(0, 0, 33)).toMatchObject({ met: false, needed: null });
    expect(computeQuorum(10, 10, null)).toMatchObject({
      met: false,
      percent: null,
    });
  });
});

describe('noticeCheck', () => {
  it('counts India calendar days, not 24-hour periods', () => {
    expect(
      noticeCheck('2026-03-01T17:00:00Z', '2026-03-01T19:00:00Z', 1),
    ).toEqual({ requiredDays: 1, givenDays: 1, short: false });
  });

  it('flags short notice below the required days', () => {
    expect(
      noticeCheck('2026-03-01T04:30:00Z', '2026-03-14T04:30:00Z', 14),
    ).toEqual({ requiredDays: 14, givenDays: 13, short: true });
    expect(
      noticeCheck('2026-03-01T04:30:00Z', '2026-03-15T04:30:00Z', 14)?.short,
    ).toBe(false);
  });

  it('allows zero required days and rejects invalid dates', () => {
    expect(
      noticeCheck('2026-03-01T04:30:00Z', '2026-03-01T05:30:00Z', 0)?.short,
    ).toBe(false);
    expect(noticeCheck('not a date', '2026-03-01T05:30:00Z', 3)).toBeNull();
  });
});
