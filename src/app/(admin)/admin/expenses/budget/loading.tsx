// Stream the P42.5 budget route while its data loads.
import { Skeleton } from '@/components/ui/feedback';

export default function ExpenseBudgetLoading() {
  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Budget</h1>
      <Skeleton label="Loading budget" rows={6} />
    </section>
  );
}
