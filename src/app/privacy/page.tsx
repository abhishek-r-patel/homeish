// Public privacy policy route, served on every configured non-society host.
import type { Metadata } from 'next';
import { PrivacyPage } from '@/core/website/privacy-page';

export const metadata: Metadata = {
  title: 'Homeish | Privacy policy',
  description:
    'How Homeish collects, uses, retains and protects personal data, including Google user data.',
};

export default function Page() {
  return <PrivacyPage />;
}
