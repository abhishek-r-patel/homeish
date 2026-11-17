// Show the resident's own posts and listings in every review state.
import { CommunityMyItemsView } from '@/components/community/resident';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityMyItems } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';

export const metadata = {
  title: 'My posts and listings | Homeish',
  robots: { index: false, follow: false },
};

export default async function CommunityMinePage() {
  const result = await loadCommunityPage(['resident'], getCommunityMyItems);
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/community"
        retryHref="/community/mine"
      />
    );
  }
  return <CommunityMyItemsView items={result.data} />;
}
