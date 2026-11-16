// Keep poll navigation responsive while the authorized list loads.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return <Skeleton label="Loading polls" rows={5} />;
}
