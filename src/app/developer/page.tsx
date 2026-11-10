// Confirm the protected developer session while the P4 console is pending.
import { DeveloperSignOut } from '@/components/auth/developer-sign-out';

export const metadata = {
  title: 'Developer Console | Homeish',
  robots: { index: false, follow: false },
};

export default function DeveloperHomePage() {
  return (
    <section className="grid gap-space-3">
      <h1 className="text-heading font-semibold">Developer access verified</h1>
      <p className="text-body text-ink-muted">
        Your second factor is current. The developer tools will appear here in
        the Core Platform phase.
      </p>
      <DeveloperSignOut />
    </section>
  );
}
