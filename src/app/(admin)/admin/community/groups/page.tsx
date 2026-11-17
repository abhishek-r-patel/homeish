// Let the administrator create, rename, archive and bring back Community groups.
import { CommunityAdminGroupsView } from '@/components/community/admin';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityAdminGroups } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityAdminActions } from '../action-set';

export const metadata = {
  title: 'Community groups | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminCommunityGroupsPage() {
  const result = await loadCommunityPage(['admin'], getCommunityAdminGroups);
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/admin/community"
        retryHref="/admin/community/groups"
      />
    );
  }
  return (
    <CommunityAdminGroupsView
      groups={result.data}
      actions={communityAdminActions}
    />
  );
}
