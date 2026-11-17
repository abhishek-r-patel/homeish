// Return to a validated application route after sign-in.
import Link from 'next/link';
import type { Metadata } from 'next';
import { safeReturnPath } from '@/core/auth';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateAuthMessage } from '@/core/i18n/catalogs/hi-auth';
import { translateMessage } from '@/core/i18n/messages';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const translateShared = (source: string) => translateMessage(locale, source);
  return {
    title: translateAuthMessage(
      locale,
      'Session ended | Homeish',
      undefined,
      translateShared,
    ),
    robots: { index: false, follow: false },
  };
}

export default async function SessionExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo) ?? '/session';
  const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  const locale = await getRequestLocale();
  const translateShared = (source: string) => translateMessage(locale, source);
  const t = (source: string) =>
    translateAuthMessage(locale, source, undefined, translateShared);

  return (
    <div className="grid gap-space-5">
      <div className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          {t('Session expired')}
        </p>
        <h1 className="text-heading font-semibold">
          {t('Your session has ended')}
        </h1>
        <p className="text-body text-ink-muted">
          {t('Sign in again to continue where you left off.')}
        </p>
      </div>
      <Link
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-brand bg-brand px-space-4 text-body-strong text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus medium:w-auto"
        href={loginUrl}
      >
        {t('Sign in')}
      </Link>
    </div>
  );
}
