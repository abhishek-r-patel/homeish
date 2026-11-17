// Show the Community review queues: waiting, hidden by reports, reported and removed.
import { z } from 'zod';
import { CommunityAdminQueueView } from '@/components/community/admin';
import { CommunityRouteState } from '@/components/community/shared';
import { getCommunityAdminQueue } from '@/core/community/operations';
import { loadCommunityPage } from '@/core/community/page-access';
import { communityAdminQueueSchema } from '@/core/community/validation';

export const metadata = {
  title: 'Community review | Homeish',
  robots: { index: false, follow: false },
};

const first = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{
    queue?: string | string[];
    page?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const queue = communityAdminQueueSchema.parse(first(query.queue));
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .catch(1)
    .parse(first(query.page) ?? 1);
  const result = await loadCommunityPage(['admin'], () =>
    getCommunityAdminQueue(queue, page),
  );
  if (result.state) {
    return (
      <CommunityRouteState
        kind={result.state}
        returnHref="/admin"
        retryHref="/admin/community"
      />
    );
  }
  return (
    <CommunityAdminQueueView queue={queue} result={result.data} page={page} />
  );
}
