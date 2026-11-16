// Keep the analytics page responsive while live figures are worked out.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return <Skeleton label="Loading analytics" rows={6} />;
}
