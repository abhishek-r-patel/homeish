// List muted residents, lift mutes and find a resident to mute.
import { CommunityAdminMutesView } from '@/components/community/admin';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityAdminMutes } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityAdminActions } from '../action-set';

export const metadata = {
  title: 'Muted residents | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminCommunityMutesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const result = await loadCommunityPage(['admin'], () =>
    getCommunityAdminMutes(typeof q === 'string' ? q : null),
  );
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/admin/community"
        retryHref="/admin/community/mutes"
      />
    );
  }
  return (
    <CommunityAdminMutesView
      mutes={result.data.mutes}
      members={result.data.members}
      search={result.data.search}
      actions={communityAdminActions}
    />
  );
}
