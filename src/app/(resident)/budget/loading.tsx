// Stream the shared resident budget summary while it loads.
import { Skeleton } from '@/components/ui/feedback';

export default function ResidentBudgetLoading() {
  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Budget</h1>
      <Skeleton label="Loading budget summary" rows={5} />
    </section>
  );
}
