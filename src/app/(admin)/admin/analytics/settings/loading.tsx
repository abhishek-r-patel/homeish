// Keep the analytics settings responsive while the catalogue loads.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return <Skeleton label="Loading analytics settings" rows={6} />;
}
