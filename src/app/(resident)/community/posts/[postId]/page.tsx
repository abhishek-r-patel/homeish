// Show one community post with its photos, replies and the author's or reader's actions.
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { CommunityPostView } from '@/components/community/resident';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityPost } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityResidentActions } from '../../action-set';

export const metadata = {
  title: 'Community post | Homeish',
  robots: { index: false, follow: false },
};

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  if (!z.uuid().safeParse(postId).success) notFound();
  const result = await loadCommunityPage(['resident'], () =>
    getCommunityPost(postId),
  );
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/community"
        retryHref={`/community/posts/${postId}`}
      />
    );
  }
  return (
    <CommunityPostView
      detail={result.data.detail}
      photoUrls={result.data.photoUrls}
      actions={communityResidentActions}
    />
  );
}
