// Keep Accounts navigation responsive while the AGM draft loads.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Accounts AGM draft</h1>
      <Skeleton label="Loading AGM draft" rows={7} />
    </section>
  );
}
