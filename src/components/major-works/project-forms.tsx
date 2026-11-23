// Render P50.1 project, status, budget and spend forms.
'use client';
import { useId } from 'react';
import { saveMajorWorksProjectAction } from '@/app/(admin)/admin/major-works/actions';
import { rupeesFromPaise } from '@/core/billing/validation';
import {
  MAJOR_WORKS_PRIORITIES,
  type MajorWorksAdminList,
  type MajorWorksProject,
} from '@/core/major-works/validation';
import { EXPENSE_REPAIR_FORECAST_CATEGORIES } from '@/core/expense/repair-forecast-validation';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';

const CATEGORY_LABELS = {
  structure: 'Structure',
  waterproofing: 'Waterproofing',
  painting: 'Painting',
  lifts: 'Lifts',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  fire_safety: 'Fire safety',
  other: 'Other',
} as const;

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
} as const;

const STATUS_LABELS = {
  planned: 'Planned',
  quoting: 'Quoting',
  approved: 'Approved',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const;

export function MajorWorksProjectForm({
  action = saveMajorWorksProjectAction,
  project,
  forecastItems,
}: {
  action?: ModuleFormAction;
  project?: MajorWorksProject;
  forecastItems: MajorWorksAdminList['forecast_items'];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={project ? t('Save repair project') : t('Add repair project')}
      input={(data) => ({
        projectId: project?.id ?? null,
        title: data.get('title'),
        location: data.get('location'),
        category: data.get('category'),
        priority: data.get('priority'),
        estimateRupees: data.get('estimateRupees'),
        plannedStartOn: data.get('plannedStartOn'),
        plannedEndOn: data.get('plannedEndOn'),
        actualStartOn: data.get('actualStartOn'),
        actualEndOn: data.get('actualEndOn'),
        progressPercent: data.get('progressPercent'),
        notes: data.get('notes'),
        forecastItemId: data.get('forecastItemId') || null,
        expectedUpdatedAt: project?.updated_at ?? null,
      })}
    >
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          defaultValue={project?.title ?? ''}
          id={`${id}-title`}
          label={t('Project title')}
          maxLength={120}
          name="title"
          required
        />
        <TextInput
          defaultValue={project?.location ?? ''}
          id={`${id}-location`}
          label={t('Location')}
          maxLength={120}
          name="location"
          required
        />
        <SelectInput
          defaultValue={project?.category ?? 'structure'}
          id={`${id}-category`}
          label={t('Category')}
          name="category"
          options={EXPENSE_REPAIR_FORECAST_CATEGORIES.map((category) => ({
            label: t(CATEGORY_LABELS[category]),
            value: category,
          }))}
          required
        />
        <SelectInput
          defaultValue={project?.priority ?? 'medium'}
          id={`${id}-priority`}
          label={t('Priority')}
          name="priority"
          options={MAJOR_WORKS_PRIORITIES.map((priority) => ({
            label: t(PRIORITY_LABELS[priority]),
            value: priority,
          }))}
          required
        />
        <AmountInput
          defaultValue={
            project ? rupeesFromPaise(project.estimate_paise) : '0.00'
          }
          id={`${id}-estimate`}
          label={t('Estimate')}
          name="estimateRupees"
          required
        />
        <TextInput
          defaultValue={String(project?.progress_percent ?? 0)}
          id={`${id}-progress`}
          inputMode="numeric"
          label={t('Progress %')}
          maxLength={3}
          name="progressPercent"
          required
        />
      </div>
      <SelectInput
        defaultValue={project?.forecast_item_id ?? ''}
        helpText={t(
          'When linked, the server copies the forecast title, category and estimate.',
        )}
        id={`${id}-forecast`}
        label={t('Repair forecast item')}
        name="forecastItemId"
        options={[
          { value: '', label: t('No forecast link') },
          ...forecastItems.map((item) => ({
            value: item.id,
            label: `${item.name} · ${t(CATEGORY_LABELS[item.category])}`,
          })),
          ...(project?.forecast_item_id &&
          !forecastItems.some((item) => item.id === project.forecast_item_id)
            ? [
                {
                  value: project.forecast_item_id,
                  label: t('Current forecast link'),
                },
              ]
            : []),
        ]}
      />
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          defaultValue={project?.planned_start_on ?? ''}
          id={`${id}-planned-start`}
          label={t('Planned start')}
          name="plannedStartOn"
          type="date"
        />
        <TextInput
          defaultValue={project?.planned_end_on ?? ''}
          id={`${id}-planned-end`}
          label={t('Planned end')}
          name="plannedEndOn"
          type="date"
        />
        <TextInput
          defaultValue={project?.actual_start_on ?? ''}
          id={`${id}-actual-start`}
          label={t('Actual start')}
          name="actualStartOn"
          type="date"
        />
        <TextInput
          defaultValue={project?.actual_end_on ?? ''}
          id={`${id}-actual-end`}
          label={t('Actual end')}
          name="actualEndOn"
          type="date"
        />
      </div>
      <TextAreaInput
        defaultValue={project?.notes ?? ''}
        id={`${id}-notes`}
        label={t('Notes')}
        maxLength={2000}
        name="notes"
        rows={4}
      />
    </ModuleActionForm>
  );
}

export { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS };
