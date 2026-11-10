// Render the S-04 society-code self-registration flow.
import type { Metadata } from 'next';
import { RegistrationFlow } from '@/components/auth/registration-flow';

export const metadata: Metadata = {
  title: 'Request access | Homeish',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <RegistrationFlow />;
}
