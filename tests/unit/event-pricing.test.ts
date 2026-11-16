// Verify event contribution previews, rupee parsing and RSVP windows match the database's charging rules.
import { describe, expect, it } from 'vitest';
import {
  contributionFor,
  paiseFromRupeeText,
  rsvpChargePreview,
  rsvpWindow,
} from '../../src/core/event/pricing';

describe('contributionFor', () => {
  it('charges nothing for free events or zero headcount', () => {
    expect(contributionFor('none', 0, 4)).toBe(0);
    expect(contributionFor('per_head', 25_000, 0)).toBe(0);
    expect(contributionFor('per_unit', 25_000, 0)).toBe(0);
  });

  it('charges once per flat or once per person', () => {
    expect(contributionFor('per_unit', 30_000, 5)).toBe(30_000);
    expect(contributionFor('per_head', 25_000, 3)).toBe(75_000);
  });
});

describe('rsvpChargePreview', () => {
  it('adds the full charge for a new going RSVP', () => {
    expect(
      rsvpChargePreview('per_head', 25_000, 0, {
        status: 'going',
        headcount: 2,
      }),
    ).toEqual({ chargePaise: 50_000, changePaise: 50_000 });
  });

  it('changes per-head charges with headcount but not per-flat charges', () => {
    expect(
      rsvpChargePreview('per_head', 25_000, 50_000, {
        status: 'going',
        headcount: 3,
      }),
    ).toEqual({ chargePaise: 75_000, changePaise: 25_000 });
    expect(
      rsvpChargePreview('per_unit', 30_000, 30_000, {
        status: 'going',
        headcount: 6,
      }),
    ).toEqual({ chargePaise: 30_000, changePaise: 0 });
  });

  it('credits the whole current charge when switching to not going', () => {
    expect(
      rsvpChargePreview('per_head', 25_000, 50_000, {
        status: 'not_going',
        headcount: 0,
      }),
    ).toEqual({ chargePaise: 0, changePaise: -50_000 });
  });
});

describe('rsvpWindow', () => {
  const starts = '2099-12-20T12:30:00.000Z';

  it('closes at the deadline when one is set, otherwise at the start', () => {
    expect(
      rsvpWindow('2099-12-18T12:30:00.000Z', starts, '2099-12-19T00:00:00Z'),
    ).toEqual({ closesAt: '2099-12-18T12:30:00.000Z', open: false });
    expect(rsvpWindow(null, starts, '2099-12-19T00:00:00Z')).toEqual({
      closesAt: starts,
      open: true,
    });
  });

  it('is closed at the exact closing instant', () => {
    expect(rsvpWindow(null, starts, new Date(starts)).open).toBe(false);
  });
});

describe('paiseFromRupeeText', () => {
  it.each([
    ['250', 25_000],
    ['250.5', 25_050],
    [' 1,000.05 ', 100_005],
    ['0.01', 1],
  ])('parses %s exactly', (text, paise) => {
    expect(paiseFromRupeeText(text)).toBe(paise);
  });

  it.each(['', 'abc', '-5', '1.234', '1e3'])('rejects %s', (text) => {
    expect(paiseFromRupeeText(text)).toBeNull();
  });
});
