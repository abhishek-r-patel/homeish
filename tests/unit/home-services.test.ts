// Verify Home-Services directory filtering, rating text and form-input rules.
import { describe, expect, it } from 'vitest';
import {
  filterHomeServicesProviders,
  homeServicesManagedState,
  homeServicesRatingSummary,
  homeServicesStarGlyphs,
  homeServicesStarLabel,
  homeServicesTelHref,
} from '../../src/core/home-services/presentation';
import {
  homeServicesProviderInputSchema,
  homeServicesRatingInputSchema,
  homeServicesReviewInputSchema,
} from '../../src/core/home-services/validation';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const CLIENT = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('home services presentation', () => {
  const providers = [
    {
      name: 'Quick Plumbing',
      service_type: 'plumber' as const,
      area: 'Sector 5',
      notes: null,
    },
    {
      name: 'Bright Wiring',
      service_type: 'electrician' as const,
      area: null,
      notes: 'Inverter and solar repairs',
    },
    {
      name: 'Shield Co',
      service_type: 'pest_control' as const,
      area: 'Sector 9',
      notes: null,
    },
  ];

  it('filters by type and by every search word across name, type label, area and notes', () => {
    const names = (
      type: Parameters<typeof filterHomeServicesProviders>[1],
      query: string,
    ) =>
      filterHomeServicesProviders(providers, type, query).map(
        (item) => item.name,
      );
    expect(names('all', '')).toHaveLength(3);
    expect(names('electrician', '')).toEqual(['Bright Wiring']);
    expect(names('all', '  SOLAR ')).toEqual(['Bright Wiring']);
    expect(names('all', 'pest sector')).toEqual(['Shield Co']);
    expect(names('all', 'sector 5')).toEqual(['Quick Plumbing']);
    expect(names('plumber', 'solar')).toEqual([]);
  });

  it('describes ratings in words and stars', () => {
    expect(homeServicesRatingSummary(null, 0)).toBe('No ratings yet');
    expect(homeServicesRatingSummary(4.25, 1)).toBe(
      '4.3 out of 5 from 1 rating',
    );
    expect(homeServicesRatingSummary(3, 12)).toBe(
      '3.0 out of 5 from 12 ratings',
    );
    expect(homeServicesStarGlyphs(3.6)).toBe('★★★★☆');
    expect(homeServicesStarGlyphs(9)).toBe('★★★★★');
    expect(homeServicesStarLabel(1)).toBe('1 star, poor');
  });

  it('derives the management state from status and archive time', () => {
    expect(
      homeServicesManagedState({ status: 'pending', archived_at: null }),
    ).toBe('pending');
    expect(
      homeServicesManagedState({ status: 'approved', archived_at: null }),
    ).toBe('listed');
    expect(
      homeServicesManagedState({
        status: 'approved',
        archived_at: '2026-11-01T00:00:00Z',
      }),
    ).toBe('archived');
    expect(
      homeServicesManagedState({ status: 'rejected', archived_at: null }),
    ).toBe('rejected');
  });

  it('builds dialable phone links', () => {
    expect(homeServicesTelHref('+91 98765-43210')).toBe('tel:+919876543210');
    expect(homeServicesTelHref(' 022 555 0101 ')).toBe('tel:0225550101');
  });
});

describe('home services input rules', () => {
  const provider = {
    providerId: null,
    name: '  Quick Plumbing ',
    serviceType: 'plumber',
    phone: '98765 43210',
    area: '',
    notes: '  ',
    expectedVersion: null,
    clientRequestId: CLIENT,
  };

  it('trims provider text, clears blanks and checks the phone pattern', () => {
    expect(homeServicesProviderInputSchema.parse(provider)).toMatchObject({
      name: 'Quick Plumbing',
      area: null,
      notes: null,
    });
    for (const phone of ['12345', 'call me', '+91 98765 43210 ext 2']) {
      expect(
        homeServicesProviderInputSchema.safeParse({ ...provider, phone })
          .success,
      ).toBe(false);
    }
    expect(
      homeServicesProviderInputSchema.safeParse({
        ...provider,
        serviceType: 'astrologer',
      }).success,
    ).toBe(false);
  });

  it('requires a version exactly when editing', () => {
    expect(
      homeServicesProviderInputSchema.safeParse({
        ...provider,
        providerId: ID,
      }).success,
    ).toBe(false);
    expect(
      homeServicesProviderInputSchema.safeParse({
        ...provider,
        expectedVersion: 1,
      }).success,
    ).toBe(false);
    expect(
      homeServicesProviderInputSchema.safeParse({
        ...provider,
        providerId: ID,
        expectedVersion: 2,
      }).success,
    ).toBe(true);
  });

  it('accepts a reason only when a suggestion is not approved', () => {
    const review = { providerId: ID, expectedVersion: 1 };
    expect(
      homeServicesReviewInputSchema.safeParse({
        ...review,
        approve: true,
        reason: 'Looks fine',
      }).success,
    ).toBe(false);
    expect(
      homeServicesReviewInputSchema.parse({
        ...review,
        approve: true,
        reason: ' ',
      }).reason,
    ).toBeNull();
    expect(
      homeServicesReviewInputSchema.safeParse({
        ...review,
        approve: false,
        reason: 'x'.repeat(301),
      }).success,
    ).toBe(false);
  });

  it('limits ratings to whole stars from 1 to 5 and short comments', () => {
    const rating = { providerId: ID, comment: null };
    for (const stars of [0, 6, 3.5, Number.NaN]) {
      expect(
        homeServicesRatingInputSchema.safeParse({ ...rating, stars }).success,
      ).toBe(false);
    }
    expect(
      homeServicesRatingInputSchema.safeParse({
        ...rating,
        stars: 5,
        comment: 'x'.repeat(501),
      }).success,
    ).toBe(false);
    expect(
      homeServicesRatingInputSchema.parse({
        ...rating,
        stars: 1,
        comment: '  ',
      }).comment,
    ).toBeNull();
  });
});
