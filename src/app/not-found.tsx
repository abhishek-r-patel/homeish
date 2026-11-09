// Shared not-found page for stale links and unknown routes.
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content-narrow flex-col items-start justify-center gap-space-4 px-space-4 text-ink">
      <h1 className="text-title font-semibold">We cannot find that page</h1>
      <Link className="min-h-12 content-center text-brand underline" href="/">
        Back to Home
      </Link>
    </main>
  );
}
