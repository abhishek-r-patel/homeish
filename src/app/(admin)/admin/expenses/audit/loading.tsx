// Keep Accounts navigation responsive while the audit tracker loads.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Accounts audit tracker</h1>
      <Skeleton label="Loading audit tracker" rows={6} />
    </section>
  );
}
