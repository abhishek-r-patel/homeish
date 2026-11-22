// Record and report factual facility activity linked to an existing source.
'use client';
import { useId } from 'react';
import { recordAmenityActivityAction } from '@/app/(resident)/amenities/actions';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  amenityActivityInputSchema,
  type AmenityFacilitiesReport,
} from '@/core/amenity/validation';
import { createComponentTranslator } from '@/core/i18n/catalogs/hi-components';
import { formatLocalizedDateTime } from '@/core/i18n/format';

const sourceLabels = {
  amenity_booking: 'Amenity booking',
  asset: 'Asset',
  amc_visit: 'AMC visit',
  service_request: 'Service request',
} as const;

export function AmenityFacilitiesView({
  report,
  action = recordAmenityActivityAction,
}: {
  report: AmenityFacilitiesReport;
  action?: ModuleFormAction;
}) {
  const id = useId();
  const { locale, translate } = useUiTranslator();
  const activeLocale = locale ?? 'en';
  const t = createComponentTranslator(activeLocale, translate);
  const formatTime = (value: string) =>
    formatLocalizedDateTime(new Date(value), activeLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: report.timezone,
    });
  return (
    <Card
      title={t('Facilities')}
      description={t(
        'Factual use and issues stay linked to their existing booking, asset, AMC visit or service request.',
      )}
    >
      <div className="grid gap-space-4">
        {!report.can_record ? (
          <Banner tone="neutral" title={t('View only')}>
            {t('Only administrators can record facility activity.')}
          </Banner>
        ) : null}
        {report.can_record && report.source_choices.length ? (
          <ModuleActionForm
            action={action}
            idempotent
            submitLabel={t('Record facility activity')}
            input={(form, clientRequestId) => {
              const source = report.source_choices.find(
                (candidate) =>
                  `${candidate.source_kind}:${candidate.source_id}` ===
                  form.get('source'),
              );
              return amenityActivityInputSchema.parse({
                sourceType: source?.source_kind,
                sourceId: source?.source_id,
                activityKind: form.get('activityKind'),
                occurredAtLocal: form.get('occurredAtLocal'),
                note: String(form.get('note') ?? ''),
                clientRequestId,
              });
            }}
          >
            <SelectInput
              id={`${id}-source`}
              name="source"
              label={t('Existing source')}
              options={report.source_choices.map((source) => ({
                value: `${source.source_kind}:${source.source_id}`,
                label: `${t(sourceLabels[source.source_kind])}: ${source.label}`,
              }))}
            />
            <SelectInput
              id={`${id}-kind`}
              name="activityKind"
              label={t('Activity')}
              options={[
                { value: 'use', label: t('Use') },
                { value: 'issue', label: t('Issue') },
              ]}
            />
            <TextInput
              id={`${id}-occurred-at`}
              name="occurredAtLocal"
              type="datetime-local"
              label={t('Event time')}
              helpText={t('Use society-local time ({timezone}).', {
                timezone: report.timezone,
              })}
              required
            />
            <TextAreaInput
              id={`${id}-note`}
              name="note"
              label={t('Factual note (optional)')}
              maxLength={500}
            />
            <p className="text-caption text-ink-muted">
              {t(
                'Issues that need a service action must continue through Service Requests. This record is not a repair, charge or accounting entry.',
              )}
            </p>
          </ModuleActionForm>
        ) : report.can_record ? (
          <p className="text-body text-ink-muted">
            {t(
              'No enabled booking, asset, AMC visit or service-request source is available. Activity cannot be recorded without one.',
            )}
          </p>
        ) : null}
        {report.items.length ? (
          <ul className="grid gap-space-3">
            {report.items.map((item) => (
              <li
                key={item.id}
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {item.activity_kind === 'use' ? t('Use') : t('Issue')} ·{' '}
                  {item.source_label}
                </p>
                <p className="text-caption">
                  {t(sourceLabels[item.source_kind])} ·{' '}
                  {formatTime(item.event_at)}
                </p>
                {item.note ? <p>{item.note}</p> : null}
                <p className="text-caption text-ink-muted">
                  {t('Recorded by {name} on {date}.', {
                    name: item.actor_name,
                    date: formatTime(item.created_at),
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No source-linked facility activity yet.')}
          </p>
        )}
      </div>
    </Card>
  );
}
