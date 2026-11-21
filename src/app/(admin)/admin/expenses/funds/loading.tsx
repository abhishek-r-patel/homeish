// Keep fund navigation responsive while the Accounts total and fund records load.
import { Skeleton } from '@/components/ui/feedback';

export default function Loading() {
  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Society funds</h1>
      <Skeleton label="Loading society funds" rows={6} />
    </section>
  );
}
