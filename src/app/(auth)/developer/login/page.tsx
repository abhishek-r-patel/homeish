// Render the isolated S-05 developer password and MFA flow.
import type { Metadata } from 'next';
import { DeveloperSignInFlow } from '@/components/auth/developer-sign-in-flow';

export const metadata: Metadata = {
  title: 'Developer sign in | Homeish',
  robots: { index: false, follow: false },
};

export default function DeveloperLoginPage() {
  return <DeveloperSignInFlow />;
}
