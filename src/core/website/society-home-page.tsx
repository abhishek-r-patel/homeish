// Entry page for an active society host whose slug matches its database society.
import { Brand } from '@/components/ui/brand';

export function SocietyHomePage({
  societyName,
  websiteOrigin,
}: {
  societyName: string;
  websiteOrigin: string;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-content-narrow px-space-5 py-space-8">
      <a
        aria-label="Homeish website"
        className="inline-block"
        href={websiteOrigin}
      >
        <Brand />
      </a>
      <h1 className="mt-space-7 text-display font-bold">{societyName}</h1>
      <p className="mt-space-4 text-ink-muted">
        Sign in with the email address your society admin registered. We will
        send you a one-time code.
      </p>
      <a
        className="mt-space-6 inline-flex min-h-12 items-center rounded-md border border-brand bg-brand px-space-5 text-body-strong text-on-brand hover:bg-brand-hover"
        href="/login?returnTo=%2Fsession"
      >
        Sign in
      </a>
    </main>
  );
}
