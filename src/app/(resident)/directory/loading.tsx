// Announce directory loading while its authenticated server read is pending.
import { Skeleton } from '@/components/ui/feedback';

export default function DirectoryLoading() {
  return (
    <section className="grid gap-space-5">
      <h1 className="text-title font-semibold">Resident directory</h1>
      <Skeleton label="Loading resident directory" rows={6} />
    </section>
  );
}
