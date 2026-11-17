// Let a resident create a marketplace listing that waits for administrator review.
import { CommunityNewListingView } from '@/components/community/resident';
import { CommunityRouteState } from '@/components/community/shared';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityResidentActions } from '../../action-set';

export const metadata = {
  title: 'New listing | Homeish',
  robots: { index: false, follow: false },
};

export default async function CommunityNewListingPage() {
  const result = await loadCommunityPage(['resident'], async () => true);
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/community/marketplace"
      />
    );
  }
  return <CommunityNewListingView actions={communityResidentActions} />;
}
