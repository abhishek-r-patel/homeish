// Consistent fail-closed page for routes belonging to disabled modules.
import { MODULE_REGISTRY } from './index';
import type { ModuleKey } from './index';

type ModuleDisabledPageProps = {
  moduleKey: ModuleKey;
  returnHref?: string;
  returnLabel?: string;
};

export function ModuleDisabledPage({
  moduleKey,
  returnHref = '/',
  returnLabel = 'Back to Home',
}: ModuleDisabledPageProps) {
  const moduleName = MODULE_REGISTRY[moduleKey].name;

  return (
    <main className="mx-auto grid min-h-[50dvh] w-full max-w-content-narrow content-center gap-space-4 p-space-4">
      <h1 className="text-title">{moduleName} is not available</h1>
      <p className="text-body text-ink-muted">
        This module is not enabled for your society. Existing information has
        not been removed.
      </p>
      <a
        className="inline-flex min-h-12 w-fit items-center rounded-md border border-rule-strong bg-surface px-space-4 text-body-strong text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        href={returnHref}
      >
        {returnLabel}
      </a>
    </main>
  );
}
