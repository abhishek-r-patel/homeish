// Provide an MFA-protected interface for account erasure.
import Link from 'next/link';
import { UserErasureForm } from '@/components/developer/user-erasure-form';
import { Card } from '@/components/ui/data-display';

export const metadata = {
  title: 'Erase User | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

export default function DeveloperUserErasurePage() {
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Erase a user</h1>
        <p className="text-body text-ink-muted">
          This permanently removes the user&apos;s authentication account and
          access. Their profile is anonymized so historical records remain
          linked, while operational history and financial records are retained.
        </p>
        <Link
          className="text-caption text-dev-label underline"
          href="/developer"
        >
          Back to Developer Console
        </Link>
      </header>
      <Card
        className="border-danger"
        description="Only submit an account covered by an approved erasure request. This action cannot be undone."
        title="Irreversible action"
      >
        <UserErasureForm />
      </Card>
    </section>
  );
}
