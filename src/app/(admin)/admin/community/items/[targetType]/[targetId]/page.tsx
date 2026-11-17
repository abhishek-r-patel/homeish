// Show a post, listing or reply in full with its reports, decisions and the author's mute state.
import { CommunityAdminItemView } from '@/components/community/admin';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityAdminItem } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityAdminActions } from '../../../action-set';

export const metadata = {
  title: 'Community item | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminCommunityItemPage({
  params,
}: {
  params: Promise<{ targetType: string; targetId: string }>;
}) {
  const { targetType, targetId } = await params;
  const result = await loadCommunityPage(['admin'], () =>
    getCommunityAdminItem(targetType, targetId),
  );
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/admin/community"
        retryHref="/admin/community"
      />
    );
  }
  return (
    <CommunityAdminItemView
      detail={result.data.detail}
      photoUrls={result.data.photoUrls}
      targetType={result.data.targetType}
      actions={communityAdminActions}
    />
  );
}
