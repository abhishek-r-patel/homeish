// Let requesters pick one of the four request priorities with a one-line hint each.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import type { ServiceRequestPriority } from '@/core/service-requests/validation';

export const PRIORITY_OPTIONS = [
  {
    value: 'critical',
    label: 'Critical',
    hint: 'Danger to people or property, or no water, power or lift.',
  },
  {
    value: 'high',
    label: 'High',
    hint: 'Stops normal use of the home or area; needs attention soon.',
  },
  {
    value: 'medium',
    label: 'Medium',
    hint: 'A normal repair or upkeep job.',
  },
  {
    value: 'low',
    label: 'Low',
    hint: 'Minor or cosmetic; it can wait.',
  },
] as const satisfies readonly {
  value: ServiceRequestPriority;
  label: string;
  hint: string;
}[];

export function ServiceRequestPriorityField({
  defaultValue = 'medium',
  idPrefix,
  name = 'priority',
}: {
  defaultValue?: ServiceRequestPriority;
  idPrefix: string;
  name?: string;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <fieldset className="grid min-w-0 gap-space-2 border-0 p-0">
      <legend className="text-body-strong">{t('Priority')}</legend>
      {PRIORITY_OPTIONS.map((option) => (
        <label
          className="flex min-h-12 items-start gap-space-2"
          htmlFor={`${idPrefix}-${option.value}`}
          key={option.value}
        >
          <input
            className="mt-space-1"
            defaultChecked={option.value === defaultValue}
            id={`${idPrefix}-${option.value}`}
            name={name}
            type="radio"
            value={option.value}
          />
          <span className="grid gap-space-1">
            <span className="text-body-strong">{t(option.label)}</span>
            <span className="text-caption text-ink-muted">
              {t(option.hint)}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
