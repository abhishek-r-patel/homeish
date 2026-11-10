// Create a society with the required Core Platform configuration.
import Link from 'next/link';
import { SocietyForm } from '@/components/developer/console-controls';
import { Card } from '@/components/ui/data-display';

export const metadata = {
  title: 'Create Society | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

export default function CreateSocietyPage() {
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <Link
          className="text-caption text-dev-label underline"
          href="/developer"
        >
          Back to societies
        </Link>
        <h1 className="text-title font-semibold">Create Society</h1>
        <p className="text-body text-ink-muted">
          This creates a trial society. Other modules remain off until enabled.
        </p>
      </header>
      <Card>
        <SocietyForm successHref="/developer" />
      </Card>
    </section>
  );
}
