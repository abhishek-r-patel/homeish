// Show a group's approved posts and the new post form, or a join prompt for non-members.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { CommunityGroupView } from '@/components/community/resident';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityGroupPage } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityResidentActions } from '../../action-set';

export const metadata = {
  title: 'Community group | Homeish',
  robots: { index: false, follow: false },
};

export default async function CommunityGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { groupId } = await params;
  if (!z.uuid().safeParse(groupId).success) notFound();
  const { page } = await searchParams;
  const pageNumber = z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .catch(1)
    .parse(typeof page === 'string' ? page : 1);
  const result = await loadCommunityPage(['resident'], () =>
    getCommunityGroupPage(groupId, pageNumber),
  );
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/community"
        retryHref={`/community/groups/${groupId}`}
      />
    );
  }
  return (
    <CommunityGroupView
      page={result.data}
      pageNumber={pageNumber}
      actions={communityResidentActions}
    />
  );
}
