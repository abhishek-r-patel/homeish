// Keep the poll workspace responsive while authorized data loads.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return <Skeleton label="Loading polls" rows={5} />;
}
