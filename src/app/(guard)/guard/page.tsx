// Show a minimal gate home and the signed-in guard identity.
import Link from 'next/link';
import { getRoleNavigation } from '@/core/modules';
import { AppError, createRequestId } from '@/core/errors';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { requireIdentifiedGuard } from '@/core/guards/operations';
import { Banner } from '@/components/ui/feedback';

export default async function GuardHomePage() {
  const context = await buildRequestContext(createRequestId());
  let guard: { id: string; name: string } | null = null;
  try {
    guard = await requireIdentifiedGuard();
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'GUARD_NOT_IDENTIFIED') {
      throw error;
    }
  }
  const gateLinks = getRoleNavigation(context.roles, [
    ...context.enabledModules,
  ]).filter(
    (item) => item.moduleKey === 'visitor' || item.moduleKey === 'delivery',
  );
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
      {gateLinks.length ? (
        <nav aria-label="Gate activity" className="grid gap-space-3">
          {gateLinks.map((item) => (
            <Link
              className="flex min-h-16 items-center rounded-md border border-rule bg-surface px-space-4 text-body-strong focus-visible:outline-2 focus-visible:outline-focus"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : (
        <p className="text-body text-ink-muted">
          Gate activity tools will appear here as society modules are enabled.
        </p>
      )}
    </section>
  );
}
