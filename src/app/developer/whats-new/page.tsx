// Write and withdraw platform release notes for society managers.
import { Card } from '@/components/ui/data-display';
import { DeveloperPlatformUpdates } from '@/components/updates/developer-updates';
import { getDeveloperPlatformUpdates } from '@/core/updates/operations';

export const metadata = {
  title: "What's new | Developer Console | Homeish",
  robots: { index: false, follow: false },
};

export default async function DeveloperWhatsNewPage() {
  const updates = await getDeveloperPlatformUpdates();
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">What&apos;s new</h1>
        <p className="text-body text-surface/80">
          Write platform notes for admins and committee members. Publishing does
          not send email or push.
        </p>
      </header>
      <Card title="Release notes">
        <DeveloperPlatformUpdates updates={updates} />
      </Card>
    </section>
  );
}
