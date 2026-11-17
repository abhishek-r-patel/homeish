// List live marketplace listings with a type filter and search.
import { z } from 'zod';
import { CommunityMarketplaceView } from '@/components/community/resident';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityMarketplace } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import {
  COMMUNITY_SEARCH_MAX,
  communityListingTypeFilterSchema,
} from '@/core/community/validation';

export const metadata = {
  title: 'Marketplace | Homeish',
  robots: { index: false, follow: false },
};

const first = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

export default async function CommunityMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const filter = {
    type: communityListingTypeFilterSchema.parse(first(query.type) ?? null),
    search: first(query.q)?.trim().slice(0, COMMUNITY_SEARCH_MAX) || null,
    page: z.coerce
      .number()
      .int()
      .min(1)
      .max(10_000)
      .catch(1)
      .parse(first(query.page) ?? 1),
  };
  const result = await loadCommunityPage(['resident'], () =>
    getCommunityMarketplace(filter),
  );
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/community"
        retryHref="/community/marketplace"
      />
    );
  }
  return (
    <CommunityMarketplaceView
      marketplace={result.data.marketplace}
      photoUrls={result.data.photoUrls}
      filter={filter}
    />
  );
}
