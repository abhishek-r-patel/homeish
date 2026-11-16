// Keep the resident meetings screen responsive while authorized data loads.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return <Skeleton label="Loading meetings" rows={5} />;
}
