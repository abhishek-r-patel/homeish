// Show a minimal gate home and the signed-in guard identity.
import { requireIdentifiedGuard } from '@/core/guards/operations';
import { AppError } from '@/core/errors';
import { Banner } from '@/components/ui/feedback';

export default async function GuardHomePage() {
  let guard: { id: string; name: string } | null = null;
  try {
    guard = await requireIdentifiedGuard();
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'GUARD_NOT_IDENTIFIED') {
      throw error;
    }
  }
  return (
    <section className="grid gap-space-4">
      <header className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          Gate
        </p>
        <h1 className="text-heading font-semibold">Gate home</h1>
      </header>
      {guard ? (
        <Banner tone="success">
          <p>Ready to record gate activity as {guard.name}.</p>
        </Banner>
      ) : (
        <Banner tone="warning">
          <p>Identify the guard on duty before recording gate activity.</p>
        </Banner>
      )}
      <p className="text-body text-ink-muted">
        Gate activity tools will appear here as society modules are enabled.
      </p>
    </section>
  );
}
