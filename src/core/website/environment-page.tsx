// Explicit synthetic demo and isolated beta entry screens.
import { Brand } from '@/components/ui/brand';
import type { SiteSurface } from '@/core/config/host-routing';
import { DemoPreview } from './demo-preview';

const entries = {
  demo: {
    label: 'Synthetic demo',
    title: 'Meet your sample society',
    description:
      'Explore a small interactive preview using invented data only. Full society workflows and a database-backed demo are not available yet. Do not enter real resident or visitor details.',
  },
  beta: {
    label: 'Testing only',
    title: 'Homeish beta',
    description:
      'This is the separate testing environment for upcoming Homeish changes. Society sign-in and database-backed features are not configured yet. Use synthetic data only; never use real society information here.',
  },
};

export function EnvironmentPage({
  surface,
  websiteOrigin,
}: {
  surface: Exclude<SiteSurface, 'website' | 'society'>;
  websiteOrigin: string;
}) {
  const copy = entries[surface];
  return (
    <main className="mx-auto min-h-dvh max-w-content-narrow px-space-5 py-space-8">
      <a
        aria-label="Homeish website"
        className="inline-block"
        href={websiteOrigin}
      >
        <Brand />
      </a>
      <p className="mt-space-7 w-fit rounded-sm bg-warning-tint px-space-3 py-space-2 text-caption font-semibold text-warning">
        {copy.label}
      </p>
      <h1 className="mt-space-5 text-display font-bold">{copy.title}</h1>
      <p className="mt-space-4 text-ink-muted">{copy.description}</p>
      {surface === 'demo' && <DemoPreview />}
      <a
        className="mt-space-6 inline-flex min-h-12 items-center text-brand underline underline-offset-4"
        href={websiteOrigin}
      >
        Back to the Homeish website
      </a>
    </main>
  );
}
