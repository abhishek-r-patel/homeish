// Configure permanent opt-in cleanup for completed register records and cases.
'use client';

import type { DataCleanupRule } from '@/core/compliance/validation';
import { saveDataCleanupRuleAction } from '@/app/(admin)/admin/compliance/actions';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { useUiTranslator } from '@/components/ui/language';

const kinds = [
  {
    id: 'compliance_entry',
    label: 'Completed compliance entries',
  },
  {
    id: 'official_case',
    label: 'Closed official cases',
  },
] as const;

export function DataCleanupControls({
  canManage,
  rules,
}: {
  canManage: boolean;
  rules: DataCleanupRule[];
}) {
  const { translate: t } = useUiTranslator();
  return (
    <div className="grid gap-space-5" id="data-cleanup">
      <p className="text-body text-ink-muted">
        {t(
          'Records are kept permanently by default. Enabling cleanup permanently deletes eligible records and their attached case files after the selected age; this is audited and cannot be undone.',
        )}
      </p>
      {kinds.map((kind) => {
        const rule = rules.find((item) => item.record_kind === kind.id);
        return (
          <ModuleActionForm
            action={saveDataCleanupRuleAction}
            input={(form) => ({
              recordKind: kind.id,
              enabled: form.get('enabled') === 'on',
              olderThanYears: Number(form.get('olderThanYears')),
              expectedVersion: rule?.version ?? null,
            })}
            key={`${kind.id}:${rule?.version ?? 0}`}
            submitDisabled={!canManage}
            submitLabel={t('Save {kind} cleanup rule', { kind: t(kind.label) })}
          >
            <label className="flex items-start gap-space-3">
              <input
                defaultChecked={rule?.enabled ?? false}
                disabled={!canManage}
                name="enabled"
                type="checkbox"
              />
              <span>{t(kind.label)}</span>
            </label>
            <label className="grid gap-space-1">
              {t('Delete after years')}
              <input
                className="min-h-12 w-full rounded-md border border-rule px-space-3"
                defaultValue={rule?.older_than_years ?? 10}
                disabled={!canManage}
                max={20}
                min={1}
                name="olderThanYears"
                required
                type="number"
              />
            </label>
          </ModuleActionForm>
        );
      })}
    </div>
  );
}
