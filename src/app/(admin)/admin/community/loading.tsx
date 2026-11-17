// Keep the administrator Community screens responsive while authorized data loads.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return <Skeleton label="Loading Community administration" rows={5} />;
}
