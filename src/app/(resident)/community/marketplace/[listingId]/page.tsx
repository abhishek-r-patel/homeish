// Show one marketplace listing with photos, the shared phone, replies and the poster's actions.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { CommunityListingView } from '@/components/community/resident';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityListing } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityResidentActions } from '../../action-set';

export const metadata = {
  title: 'Listing | Homeish',
  robots: { index: false, follow: false },
};

export default async function CommunityListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  if (!z.uuid().safeParse(listingId).success) notFound();
  const result = await loadCommunityPage(['resident'], () =>
    getCommunityListing(listingId),
  );
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/community/marketplace"
        retryHref={`/community/marketplace/${listingId}`}
      />
    );
  }
  return (
    <CommunityListingView
      detail={result.data.detail}
      photoUrls={result.data.photoUrls}
      actions={communityResidentActions}
    />
  );
}
