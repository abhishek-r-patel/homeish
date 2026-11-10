// Render the S-01/S-02 email-code sign-in flow.
import type { Metadata } from 'next';
import { SignInFlow } from '@/components/auth/sign-in-flow';
import { safeReturnPath } from '@/core/auth';

export const metadata: Metadata = {
  title: 'Sign in | Homeish',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  return <SignInFlow returnTo={safeReturnPath(params.returnTo)} />;
}
