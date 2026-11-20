// Exercise the help browser with synthetic roles and module sets; never call hosted Auth or data.
'use client';
import { useMemo, useState } from 'react';
import { HelpBrowser } from '@/components/help/help-browser';
import { SelectInput } from '@/components/ui/select-input';
import { buildHelpView } from '@/core/help/filter';
import { MODULE_KEYS, type ModuleKey } from '@/core/modules/module-types';
import { SOCIETY_ROLES, type SocietyRole } from '@/core/permissions';

const MODULE_SETS = {
  all: new Set<ModuleKey>(MODULE_KEYS),
  core: new Set<ModuleKey>(['core']),
} as const;

export default function HelpFixturePage() {
  const [role, setRole] = useState<SocietyRole>('admin');
  const [modules, setModules] = useState<keyof typeof MODULE_SETS>('all');
  const view = useMemo(
    () =>
      buildHelpView({
        roles: [role],
        enabledModules: MODULE_SETS[modules],
        languagePreference: 'en',
        isHindiEnabled: false,
      }),
    [role, modules],
  );
  return (
    <main className="mx-auto grid min-h-dvh max-w-content-default min-w-0 content-start gap-space-5 px-space-4 py-space-6">
      <div className="grid gap-space-3 medium:grid-cols-2">
        <SelectInput
          id="fixture-role"
          label="Fixture role"
          options={SOCIETY_ROLES.map((value) => ({ value, label: value }))}
          value={role}
          onChange={(event) => setRole(event.target.value as SocietyRole)}
        />
        <SelectInput
          id="fixture-modules"
          label="Fixture modules"
          options={[
            { value: 'all', label: 'All modules on' },
            { value: 'core', label: 'Core only' },
          ]}
          value={modules}
          onChange={(event) =>
            setModules(event.target.value as keyof typeof MODULE_SETS)
          }
        />
      </div>
      <h1 className="text-title font-semibold">Help</h1>
      <HelpBrowser key={`${role}:${modules}`} view={view} />
    </main>
  );
}
