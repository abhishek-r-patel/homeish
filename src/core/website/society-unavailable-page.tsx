// Placeholder for a reserved society that has not been onboarded yet.
import { Brand } from '@/components/ui/brand';
import type { ReservedSociety } from '@/core/config/societies';

export function SocietyUnavailablePage({
  society,
  websiteOrigin,
}: {
  society: ReservedSociety;
  websiteOrigin: string;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-content-narrow px-space-5 py-space-8">
      <a
        aria-label="Dwello website"
        className="inline-block"
        href={websiteOrigin}
      >
        <Brand />
      </a>
      <h1 className="mt-space-7 text-display font-bold">
        {`${society.name} is not open yet`}
      </h1>
      <p className="mt-space-4 text-ink-muted">
        This society address is reserved, but sign-in is not available yet. Your
        society admin will let you know when it opens.
      </p>
      <a
        className="mt-space-6 inline-flex min-h-12 items-center text-brand underline underline-offset-4"
        href={websiteOrigin}
      >
        Back to the Dwello website
      </a>
    </main>
  );
}
