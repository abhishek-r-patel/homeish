// Edit P41 AGM section switches and the admin-written draft sections.
'use client';
import { useId, useState } from 'react';
import {
  saveExpenseAgmDraftAction,
  saveExpenseAgmSettingsAction,
} from '@/app/(admin)/admin/expenses/actions';
import { Button } from '@/components/ui/button';
import { CheckboxInput } from '@/components/ui/choice-controls';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import {
  EXPENSE_AGM_SECTION_KEYS,
  type ExpenseAgmDraft,
} from '@/core/expense/validation';

const SECTION_LABELS = {
  finances: "Year's finances",
  comparison: 'Multi-year comparison',
  funds: 'Funds',
  audit: 'Audit status and opinion',
  position: 'Financial-position summary',
  written: 'Admin-written sections',
};

export function ExpenseAgmSettingsForm({
  action = saveExpenseAgmSettingsAction,
  sections,
  updatedAt,
}: {
  action?: ModuleFormAction;
  sections: ExpenseAgmDraft['sections'];
  updatedAt: string;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save AGM sections')}
      input={(data) => ({
        sections: Object.fromEntries(
          EXPENSE_AGM_SECTION_KEYS.map((key) => [key, data.get(key) === 'on']),
        ),
        expectedUpdatedAt: updatedAt,
      })}
    >
      <div className="grid gap-space-2">
        {EXPENSE_AGM_SECTION_KEYS.map((key) => (
          <CheckboxInput
            id={`${id}-${key}`}
            key={key}
            name={key}
            defaultChecked={sections[key]}
            label={t(SECTION_LABELS[key])}
          />
        ))}
      </div>
    </ModuleActionForm>
  );
}

export function ExpenseAgmDraftForm({
  action = saveExpenseAgmDraftAction,
  draft,
  financialYearStart,
}: {
  action?: ModuleFormAction;
  draft: ExpenseAgmDraft['draft'];
  financialYearStart: string;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [sections, setSections] = useState(draft?.written_sections ?? []);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t(draft ? 'Save AGM draft' : 'Create AGM draft')}
      input={(data) => ({
        draftId: draft?.id ?? null,
        financialYearStart,
        writtenSections: sections.map((_, index) => ({
          title: data.get(`title-${index}`),
          body: data.get(`body-${index}`),
        })),
        expectedVersion: draft?.version ?? null,
      })}
    >
      {sections.length === 0 ? (
        <p className="text-ink-muted">{t('No written sections yet.')}</p>
      ) : null}
      {sections.map((section, index) => (
        <fieldset
          className="grid gap-space-3 rounded-md border border-rule p-space-3"
          key={index}
        >
          <legend className="px-space-2 text-body-strong">
            {t('Section {number}', { number: index + 1 })}
          </legend>
          <TextInput
            id={`${id}-title-${index}`}
            label={t('Title')}
            name={`title-${index}`}
            required
            maxLength={120}
            defaultValue={section.title}
          />
          <TextAreaInput
            id={`${id}-body-${index}`}
            label={t('Text')}
            name={`body-${index}`}
            required
            maxLength={10_000}
            rows={6}
            defaultValue={section.body}
          />
          <Button
            type="button"
            variant="tertiary"
            onClick={() =>
              setSections((current) =>
                current.filter((_, row) => row !== index),
              )
            }
          >
            {t('Remove section')}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={sections.length >= 10}
        onClick={() =>
          setSections((current) => [...current, { title: '', body: '' }])
        }
      >
        {t('Add written section')} ({sections.length}/10)
      </Button>
    </ModuleActionForm>
  );
}
