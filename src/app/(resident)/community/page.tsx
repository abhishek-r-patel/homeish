// Show the resident's Community groups, mute status, marketplace links and alert setting.
import { CommunityHomeView } from '@/components/community/resident';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityHome } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityResidentActions } from './action-set';

export const metadata = {
  title: 'Community | Homeish',
  robots: { index: false, follow: false },
};

export default async function CommunityPage() {
  const result = await loadCommunityPage(['resident'], getCommunityHome);
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/home"
        retryHref="/community"
      />
    );
  }
  return (
    <CommunityHomeView home={result.data} actions={communityResidentActions} />
  );
}
