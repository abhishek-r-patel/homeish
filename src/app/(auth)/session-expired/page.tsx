// Return to a validated application route after sign-in.
import Link from 'next/link';
import { safeReturnPath } from '@/core/auth';

export const metadata = {
  title: 'Session ended | Homeish',
  robots: { index: false, follow: false },
};

export default async function SessionExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo) ?? '/session';
  const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          Session expired
        </p>
        <h1 className="text-heading font-semibold">Your session has ended</h1>
        <p className="text-body text-ink-muted">
          Sign in again to continue where you left off.
        </p>
      </div>
      <Link
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-brand bg-brand px-space-4 text-body-strong text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus medium:w-auto"
        href={loginUrl}
      >
        Sign in
      </Link>
    </div>
  );
}
