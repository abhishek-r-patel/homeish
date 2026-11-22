// Keep Accounts navigation responsive while P41 statements load.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Accounts statements</h1>
      <Skeleton label="Loading accounts statements" rows={8} />
    </section>
  );
}
