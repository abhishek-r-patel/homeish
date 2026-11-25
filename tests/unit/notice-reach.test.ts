// Verify the audience reach sentence and scheduled-notice qualifier.
import { describe, expect, it } from 'vitest';
import { formatNoticeReach } from '../../src/core/notices/reach';

describe('notice reach text', () => {
  it('states that scheduled figures are current at form time', () => {
    expect(formatNoticeReach({ people: 12, flats: 8 }, false)).toBe(
      'Will reach 12 people in 8 flats',
    );
    expect(formatNoticeReach({ people: 12, flats: 8 }, true)).toBe(
      'Will reach 12 people in 8 flats (as of now)',
    );
  });
});
