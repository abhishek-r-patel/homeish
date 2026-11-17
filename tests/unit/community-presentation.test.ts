// Verify Community listing states, price handling and mute wording match the database rules.
import { describe, expect, it } from 'vitest';
import {
  canRenewListing,
  formatCommunityPrice,
  isMuteActive,
  listingState,
  listingStateFromFlags,
  muteEndsText,
  paiseFromRupeeText,
  rupeeTextFromPaise,
} from '../../src/core/community/presentation';

const NOW = '2099-06-01T00:00:00.000Z';

describe('listing state', () => {
  it.each([
    [{ status: 'pending', expiresAt: null, closedAt: null }, 'pending'],
    [
      {
        status: 'rejected',
        expiresAt: '2099-01-01T00:00:00.000Z',
        closedAt: null,
      },
      'rejected',
    ],
    [
      {
        status: 'approved',
        expiresAt: '2099-07-01T00:00:00.000Z',
        closedAt: null,
      },
      'live',
    ],
    [
      {
        status: 'approved',
        expiresAt: '2099-05-01T00:00:00.000Z',
        closedAt: null,
      },
      'expired',
    ],
    [
      {
        status: 'approved',
        expiresAt: '2099-05-01T00:00:00.000Z',
        closedAt: '2099-04-01T00:00:00.000Z',
      },
      'closed',
    ],
  ] as const)('derives %o as %s', (listing, expected) => {
    expect(listingState(listing, NOW)).toBe(expected);
  });

  it('prefers the database flags and only renews live or expired listings', () => {
    expect(
      listingStateFromFlags({
        status: 'approved',
        expired: true,
        closed: true,
      }),
    ).toBe('closed');
    expect(
      listingStateFromFlags({
        status: 'approved',
        expired: true,
        closed: false,
      }),
    ).toBe('expired');
    expect(
      listingStateFromFlags({
        status: 'hidden',
        expired: false,
        closed: false,
      }),
    ).toBe('hidden');
    expect(canRenewListing('expired')).toBe(true);
    expect(canRenewListing('live')).toBe(true);
    expect(canRenewListing('closed')).toBe(false);
    expect(canRenewListing('pending')).toBe(false);
  });
});

describe('prices', () => {
  it('formats paise with Indian grouping and shows zero as free', () => {
    expect(formatCommunityPrice(null)).toBeNull();
    expect(formatCommunityPrice(0)).toBe('Free');
    expect(formatCommunityPrice(12_500_000)).toBe('₹1,25,000');
    expect(formatCommunityPrice(49_950)).toBe('₹499.50');
  });

  it('parses typed rupees into exact paise and rejects bad input', () => {
    expect(paiseFromRupeeText('1,25,000')).toBe(12_500_000);
    expect(paiseFromRupeeText(' 499.5 ')).toBe(49_950);
    expect(paiseFromRupeeText('0.07')).toBe(7);
    expect(paiseFromRupeeText('12.345')).toBeNull();
    expect(paiseFromRupeeText('-5')).toBeNull();
    expect(paiseFromRupeeText('abc')).toBeNull();
    expect(rupeeTextFromPaise(49_950)).toBe('499.50');
    expect(rupeeTextFromPaise(250_000)).toBe('2500');
    expect(rupeeTextFromPaise(null)).toBe('');
  });
});

describe('mutes', () => {
  it('treats an open-ended mute as active until lifted', () => {
    const mute = { mutedUntil: null, untilLifted: true, reason: null };
    expect(isMuteActive(mute, NOW)).toBe(true);
    expect(muteEndsText(mute)).toBe('until an administrator lifts it');
  });

  it('ends a timed mute at its end time', () => {
    const mute = {
      mutedUntil: '2099-06-01T06:30:00.000Z',
      untilLifted: false,
      reason: 'Spam',
    };
    expect(isMuteActive(mute, NOW)).toBe(true);
    expect(isMuteActive(mute, '2099-06-02T00:00:00.000Z')).toBe(false);
    expect(isMuteActive(null, NOW)).toBe(false);
    expect(muteEndsText(mute)).toMatch(/^until 1 Jun 2099, 12:00\s?pm IST$/i);
  });
});
