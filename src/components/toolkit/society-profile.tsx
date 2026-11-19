// Show the society reference profile with its advisory setup checklist, and let admins edit the reference fields.
'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, StatusChip } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import {
  MONTH_LABELS,
  NOT_ADDED,
  PROFILE_EDITABLE_FIELDS,
  PROFILE_FIELDS,
  PROFILE_SECTIONS,
  SOCIETY_TYPE_LABELS,
  profileFieldState,
  profileSectionCompletion,
  profileValues,
  societyProfileSaveInputSchema,
  type ProfileField,
  type ProfileValue,
  type SocietyProfileView,
  type SocietyType,
} from '@/core/toolkit/validation';
import { useToolkitDates } from './shared';

export type SocietyProfileActions = { saveProfile: ModuleFormAction };

function useProfileFormat() {
  const { translate: t } = useUiTranslator();
  const dates = useToolkitDates();
  return (field: ProfileField, value: ProfileValue | undefined) => {
    if (value === null || value === undefined || String(value).trim() === '')
      return t(NOT_ADDED);
    if (field.kind === 'date') return dates.date(String(value));
    if (field.kind === 'month') return dates.month(Number(value));
    if (field.kind === 'society_type')
      return t(SOCIETY_TYPE_LABELS[value as SocietyType] ?? String(value));
    return String(value);
  };
}

export function SocietyProfileScreen({
  view,
  actions,
}: {
  view: SocietyProfileView;
  actions: SocietyProfileActions;
}) {
  const { translate: t } = useUiTranslator();
  const dates = useToolkitDates();
  const format = useProfileFormat();
  const [editing, setEditing] = useState(false);
  const values = profileValues(view);
  const visible = new Set(
    PROFILE_FIELDS.filter(
      (field) => !field.restricted || view.restricted_visible,
    ).map((field) => field.key),
  );
  const missing = view.completeness.missing_fields
    .map((key) => PROFILE_FIELDS.find((field) => field.key === key))
    .filter((field): field is ProfileField => Boolean(field));

  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Society profile')}</h1>
        <p className="text-ink-muted">
          {t(
            'Reference details for your society. They never change billing, late fees or reports.',
          )}
        </p>
        {view.updated_by_name && view.updated_at ? (
          <p className="text-caption text-ink-muted">
            {t('Last updated by {name} on {date}', {
              name: view.updated_by_name,
              date: dates.date(view.updated_at),
            })}
          </p>
        ) : null}
      </header>

      <Card
        title={t('Setup checklist')}
        description={t('{filled} of {total} required fields filled', {
          filled: view.completeness.filled_count,
          total: view.completeness.required_count,
        })}
      >
        <div className="grid gap-space-3">
          <p>
            {t(
              'Advisory only. Missing details never block anything in Homeish.',
            )}
          </p>
          {missing.length ? (
            <div className="grid gap-space-1">
              <p className="text-body-strong">{t('Still missing')}</p>
              <ul className="list-disc pl-space-5">
                {missing.map((field) => (
                  <li key={field.key}>{t(field.label)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>{t('All required fields are filled.')}</p>
          )}
        </div>
      </Card>

      <Banner tone="info">
        {t(
          'Name, address, city, official email and phone come from your society’s registered details. Contact Homeish support to change them.',
        )}
      </Banner>
      {!view.restricted_visible ? (
        <Banner tone="info">
          {t(
            'Society PAN, bank details and office-bearer mobile numbers are shown to admins only.',
          )}
        </Banner>
      ) : null}

      {view.can_manage && view.restricted_visible ? (
        editing ? (
          <Card title={t('Edit society profile')}>
            <ProfileForm view={view} action={actions.saveProfile} />
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t('Cancel')}
            </Button>
          </Card>
        ) : (
          <div>
            <Button onClick={() => setEditing(true)}>
              {t('Edit profile')}
            </Button>
          </div>
        )
      ) : null}

      {PROFILE_SECTIONS.map((section) => {
        const completion = profileSectionCompletion(
          section.key,
          values,
          visible,
        );
        const fields = PROFILE_FIELDS.filter(
          (field) => field.section === section.key && visible.has(field.key),
        );
        return (
          <Card
            key={section.key}
            title={t(section.label)}
            description={t('{filled} of {total} filled', {
              filled: completion.filled,
              total: completion.total,
            })}
          >
            <dl className="grid min-w-0 gap-space-3">
              {fields.map((field) => {
                const state = profileFieldState(field.key, values);
                return (
                  <div
                    key={field.key}
                    className="grid min-w-0 gap-space-1 border-b border-rule pb-space-2 medium:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] medium:items-center medium:gap-space-3"
                  >
                    <dt className="text-caption text-ink-muted">
                      {t(field.label)}
                    </dt>
                    <dd className="min-w-0">
                      {format(field, values[field.key])}
                    </dd>
                    <dd>
                      <StatusChip
                        status={`profile_field.${state}`}
                        detail={
                          field.fromSociety
                            ? t('Registered details')
                            : undefined
                        }
                      />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        );
      })}
    </section>
  );
}

function ProfileForm({
  view,
  action,
}: {
  view: SocietyProfileView;
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const dates = useToolkitDates();
  const id = useId();
  const initial = (key: string) => {
    const value = view.profile[key];
    return value === null || value === undefined ? '' : String(value);
  };
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save profile')}
      input={(form) =>
        societyProfileSaveInputSchema.parse({
          values: Object.fromEntries(
            PROFILE_EDITABLE_FIELDS.map((field) => [
              field.key,
              String(form.get(field.key) ?? ''),
            ]),
          ),
          expectedVersion: view.version,
        })
      }
    >
      {PROFILE_SECTIONS.map((section) => (
        <fieldset key={section.key} className="grid min-w-0 gap-space-3">
          <legend className="text-body-strong">{t(section.label)}</legend>
          {PROFILE_EDITABLE_FIELDS.filter(
            (field) => field.section === section.key,
          ).map((field) => {
            const common = {
              id: `${id}-${field.key}`,
              name: field.key,
              label: t(field.label),
              helpText: field.help ? t(field.help) : undefined,
              defaultValue: initial(field.key),
            };
            if (field.kind === 'society_type')
              return (
                <SelectInput
                  key={field.key}
                  {...common}
                  options={[
                    { value: '', label: t(NOT_ADDED) },
                    ...Object.entries(SOCIETY_TYPE_LABELS).map(
                      ([value, label]) => ({ value, label: t(label) }),
                    ),
                  ]}
                />
              );
            if (field.kind === 'month')
              return (
                <SelectInput
                  key={field.key}
                  {...common}
                  options={[
                    { value: '', label: t(NOT_ADDED) },
                    ...MONTH_LABELS.map((_, index) => ({
                      value: String(index + 1),
                      label: dates.month(index + 1),
                    })),
                  ]}
                />
              );
            return (
              <TextInput
                key={field.key}
                {...common}
                type={field.kind === 'date' ? 'date' : 'text'}
                inputMode={
                  field.kind === 'integer'
                    ? 'numeric'
                    : field.kind === 'decimal'
                      ? 'decimal'
                      : field.key.endsWith('_mobile')
                        ? 'tel'
                        : undefined
                }
                maxLength={field.kind === 'text' ? field.max : undefined}
              />
            );
          })}
        </fieldset>
      ))}
    </ModuleActionForm>
  );
}
