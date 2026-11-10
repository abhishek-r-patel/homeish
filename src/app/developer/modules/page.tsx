// Manage enabled modules for one society without changing stored module data.
import Link from 'next/link';
import {
  getDeveloperModules,
  getDeveloperSocieties,
} from '@/core/developer/console';
import {
  ModuleSettingsControl,
  ModuleToggleControl,
} from '@/components/developer/console-controls';
import { Card, StatusChip } from '@/components/ui/data-display';
import { EmptyState, ErrorPanel } from '@/components/ui/feedback';

export const metadata = {
  title: 'Modules | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

type ModulePageProps = {
  searchParams: Promise<{ societyId?: string }>;
};

export default async function DeveloperModulesPage({
  searchParams,
}: ModulePageProps) {
  const [{ societyId }, societyList] = await Promise.all([
    searchParams,
    getDeveloperSocieties(1, 100),
  ]);
  if (!societyId) {
    return (
      <section className="grid gap-space-5">
        <header className="grid gap-space-2">
          <h1 className="text-title font-semibold">Modules</h1>
          <p className="text-body text-ink-muted">
            Choose a society to review its Core Platform modules.
          </p>
        </header>
        {societyList.societies.length === 0 ? (
          <Card>
            <EmptyState
              action={
                <Link
                  className="text-body-strong text-brand underline"
                  href="/developer/societies/new"
                >
                  Create Society
                </Link>
              }
              description="Create a society before managing its modules."
              title="No societies yet"
            />
          </Card>
        ) : (
          <form
            action="/developer/modules"
            className="grid max-w-content-narrow gap-space-3"
            method="get"
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="module-society"
            >
              Society
              <select
                className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
                id="module-society"
                name="societyId"
                required
              >
                {societyList.societies.map((society) => (
                  <option key={society.id} value={society.id}>
                    {society.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="min-h-12 w-fit rounded-md border border-brand bg-brand px-space-4 text-body-strong text-on-brand focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              Open Modules
            </button>
          </form>
        )}
      </section>
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      societyId,
    )
  ) {
    return (
      <ErrorPanel
        message="Choose a valid society and try again."
        title="Module settings could not be opened"
      />
    );
  }

  const society = societyList.societies.find(({ id }) => id === societyId);
  if (!society) {
    return (
      <ErrorPanel
        message="This society is not available in the developer console."
        title="Society not found"
      />
    );
  }
  const modules = await getDeveloperModules(societyId);

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <Link
          className="text-caption text-dev-label underline"
          href={`/developer/societies/${societyId}`}
        >
          Back to {society.name}
        </Link>
        <h1 className="text-title font-semibold">Modules</h1>
        <p className="text-body text-ink-muted">
          Turn modules on or off for {society.name}. Turning one off keeps all
          existing information.
        </p>
      </header>
      <Card title="Core" description="The Core Platform is always on.">
        {modules
          .filter(({ key }) => key === 'core')
          .map((module) => (
            <div
              className="flex flex-wrap items-center justify-between gap-space-3"
              key={module.key}
            >
              <div>
                <h2 className="text-body-strong">{module.name}</h2>
                <p className="text-caption text-ink-muted">Always required</p>
              </div>
              <StatusChip status="module.on" />
            </div>
          ))}
      </Card>
      <Card title="Modules" description="Each change is saved separately.">
        {modules.filter(({ key }) => key !== 'core').length === 0 ? (
          <EmptyState
            description="There are no optional modules in the registry."
            title="No modules available"
          />
        ) : (
          <ul className="divide-y divide-rule">
            {modules
              .filter(({ key }) => key !== 'core')
              .map((module) => (
                <li
                  className="flex flex-col gap-space-3 py-space-4 first:pt-0 last:pb-0 medium:flex-row medium:items-center medium:justify-between"
                  key={module.key}
                >
                  <div className="grid gap-space-1">
                    <h2 className="text-body-strong">{module.name}</h2>
                    <p className="text-caption text-ink-muted">
                      {module.updatedByName
                        ? `Last changed by ${module.updatedByName}${
                            module.updatedAt
                              ? ` on ${new Intl.DateTimeFormat('en', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                }).format(new Date(module.updatedAt))}`
                              : ''
                          }`
                        : 'No changes yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-space-3">
                    <StatusChip
                      status={module.enabled ? 'module.on' : 'module.off'}
                    />
                    <ModuleToggleControl
                      enabled={module.enabled}
                      moduleKey={module.key}
                      name={module.name}
                      societyId={societyId}
                    />
                  </div>
                  <details className="w-full">
                    <summary className="min-h-10 cursor-pointer text-body text-brand underline">
                      Edit settings
                    </summary>
                    <div className="mt-space-3 max-w-content-narrow">
                      <ModuleSettingsControl
                        moduleKey={module.key}
                        settings={module.settings}
                        societyId={societyId}
                      />
                    </div>
                  </details>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
