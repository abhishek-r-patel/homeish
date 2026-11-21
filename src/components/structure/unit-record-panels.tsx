// Edit a unit's measured areas and vacancy follow-ups.
'use client';

import { useRouter } from 'next/navigation';
import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import { saveUnitRecordAction } from '@/app/(admin)/admin/structure/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { formatLocalizedDate, formatLocalizedNumber } from '@/core/i18n/format';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  unitRecordEdit,
  type UnitRecords,
} from '@/core/structure/unit-records';

function EditForm({
  unitId,
  fields,
  children,
  label,
}: {
  unitId: string;
  fields: Record<string, string | number>;
  children?: ReactNode;
  label: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = { ...Object.fromEntries(new FormData(form)), ...fields };
    const parsed = unitRecordEdit.safeParse(input);
    setResult(null);
    setInputError(null);
    if (!parsed.success) {
      setInputError(
        parsed.error.issues.find(({ code }) => code === 'custom')?.message ??
          'Check the unit record and try again.',
      );
      return;
    }
    const key = JSON.stringify(parsed.data);
    const id =
      retry.current?.key === key ? retry.current.id : crypto.randomUUID();
    retry.current = { key, id };
    startTransition(async () => {
      const saved = await saveUnitRecordAction(unitId, id, parsed.data);
      setResult(saved);
      if (saved.ok) {
        retry.current = null;
        form.reset();
        router.refresh();
      }
    });
  }
  return (
    <form className="grid gap-space-3" onSubmit={submit}>
      <fieldset disabled={pending} className="grid min-w-0 gap-space-3">
        {children}
        <div>
          <Button type="submit" loading={pending}>
            {t(label)}
          </Button>
        </div>
      </fieldset>
      {inputError ? <Banner tone="danger">{t(inputError)}</Banner> : null}
      {result ? (
        <Banner tone={result.ok ? 'success' : 'danger'}>
          {result.message ? translateFeedback(result.message) : null}
          {!result.ok && result.referenceId ? (
            <p>
              {t('Reference ID')}: {result.referenceId}
            </p>
          ) : null}
          {!result.ok && result.fieldErrors ? (
            <ul>
              {Object.entries(result.fieldErrors).map(([field, message]) => (
                <li key={field}>{translateFeedback(message)}</li>
              ))}
            </ul>
          ) : null}
        </Banner>
      ) : null}
    </form>
  );
}

const areaLabels = {
  carpet_sqft: 'Carpet area (sq ft)',
  built_up_sqft: 'Built-up area (sq ft)',
  outdoor_sqft: 'Balcony or terrace (sq ft)',
};
const statuses = {
  pending: 'Pending',
  verified: 'Verified',
  remeasure: 'Re-measure',
};
const vacancyLabels = { vacant: 'Vacant', locked: 'Locked' };

export function UnitRecordPanels({
  unit,
  records,
  canWrite,
}: {
  unit: {
    id: string;
    floor: number | null;
    active: boolean;
    area_sqft: number | null;
  };
  records: UnitRecords;
  canWrite: boolean;
}) {
  const { translate: t, locale } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const date = (value: string) =>
    formatLocalizedDate(new Date(value), locale ?? 'en', {
      dateStyle: 'medium',
      timeZone: value.length === 10 ? 'UTC' : records.timezone,
    });
  const latest = records.areas[0];
  const open = records.followups.find(({ closed_at }) => closed_at === null);
  return (
    <>
      <Card
        title={t('Measured area')}
        description={t('Measurements do not change the area used for billing.')}
      >
        <div className="grid gap-space-4">
          <p>
            {t('Billing area (sq ft)')}:{' '}
            {unit.area_sqft === null
              ? t('Not recorded')
              : number(unit.area_sqft)}
          </p>
          {records.areas.length ? (
            <ol className="grid gap-space-3">
              {records.areas.map((area) => (
                <li
                  className="rounded-md border border-rule p-space-3"
                  key={area.id}
                >
                  <p className="text-body-strong">
                    {t(statuses[area.status])} · {area.source}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {date(area.created_at)} · {area.actor ?? t('Unavailable')}
                  </p>
                  <dl className="grid gap-space-1">
                    {(
                      ['carpet_sqft', 'built_up_sqft', 'outdoor_sqft'] as const
                    ).map((field) => (
                      <div key={field}>
                        <dt>{t(areaLabels[field])}</dt>
                        <dd>
                          {area[field] === null
                            ? t('Not recorded')
                            : number(area[field])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
          ) : (
            <p>{t('No measured area has been recorded.')}</p>
          )}
          {canWrite && latest?.status === 'pending' ? (
            <EditForm
              unitId={unit.id}
              fields={{ action: 'verify', version: latest.version }}
              label="Save Area Review"
            >
              <SelectInput
                id="unit-area-review"
                name="status"
                label={t('Measurement status')}
                required
                defaultValue=""
                placeholder={t('Choose a status')}
                options={[
                  { value: 'verified', label: t('Verified') },
                  { value: 'remeasure', label: t('Re-measure') },
                ]}
              />
            </EditForm>
          ) : null}
          {canWrite ? (
            <EditForm
              unitId={unit.id}
              fields={{ action: 'measure', version: latest?.version ?? 0 }}
              label="Save Measurements"
            >
              <TextInput
                id="unit-area-source"
                label={t('Measurement source')}
                name="source"
                maxLength={120}
                required
              />
              <div className="grid max-w-[44rem] grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] items-end gap-space-3">
                <TextInput
                  id="unit-area-carpet"
                  label={t(areaLabels.carpet_sqft)}
                  name="carpet"
                  inputMode="decimal"
                />
                <TextInput
                  id="unit-area-built-up"
                  label={t(areaLabels.built_up_sqft)}
                  name="builtUp"
                  inputMode="decimal"
                />
                <TextInput
                  id="unit-area-outdoor"
                  label={t(areaLabels.outdoor_sqft)}
                  name="outdoor"
                  inputMode="decimal"
                />
              </div>
            </EditForm>
          ) : null}
        </div>
      </Card>
      <Card
        title={t('Vacancy follow-up')}
        description={t(
          'Private to admins. This record does not change occupancy, access or billing.',
        )}
      >
        <div className="grid gap-space-4">
          {records.followups.length ? (
            <ul className="grid gap-space-3">
              {records.followups.map((item) => (
                <li
                  className="rounded-md border border-rule p-space-3"
                  key={item.id}
                >
                  <p className="text-body-strong">
                    {t(vacancyLabels[item.kind])} ·{' '}
                    {t(item.closed_at ? 'Closed' : 'Open')}
                  </p>
                  <p>
                    {t('Start date')}: {date(item.starts_on)} ·{' '}
                    {t('Assigned admin')}: {item.handler ?? t('Unavailable')}
                  </p>
                  <p>
                    {t('Inspection date')}:{' '}
                    {item.inspection_on
                      ? date(item.inspection_on)
                      : t('Not recorded')}{' '}
                    · {t('Next follow-up')}: {date(item.follow_up_on)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('No vacancy follow-up has been recorded.')}</p>
          )}
          {canWrite ? (
            <EditForm
              unitId={unit.id}
              fields={{
                action: 'vacancy',
                version: open?.version ?? 0,
                id: open?.id ?? '',
              }}
              label="Save Vacancy Follow-up"
            >
              <SelectInput
                id="unit-vacancy-kind"
                name="kind"
                label={t('Follow-up type')}
                defaultValue={open?.kind ?? 'vacant'}
                required
                options={[
                  { value: 'vacant', label: t('Vacant') },
                  { value: 'locked', label: t('Locked') },
                ]}
              />
              <SelectInput
                id="unit-vacancy-admin"
                name="assignedTo"
                label={t('Assigned admin')}
                defaultValue={open?.assigned_to ?? ''}
                required
                placeholder={t('Choose an admin')}
                options={records.admins.map((admin) => ({
                  value: admin.id,
                  label: admin.name ?? t('Unavailable'),
                }))}
              />
              <TextInput
                id="unit-vacancy-start"
                label={t('Start date')}
                name="startsOn"
                type="date"
                defaultValue={open?.starts_on ?? ''}
                max={records.today}
                required
              />
              <TextInput
                id="unit-vacancy-inspect"
                label={t('Inspection date')}
                name="inspectionOn"
                type="date"
                defaultValue={open?.inspection_on ?? ''}
              />
              <TextInput
                id="unit-vacancy-next"
                label={t('Next follow-up')}
                name="followUpOn"
                type="date"
                defaultValue={open?.follow_up_on ?? ''}
                required
              />
            </EditForm>
          ) : null}
          {canWrite && open ? (
            <EditForm
              unitId={unit.id}
              fields={{ action: 'close', id: open.id, version: open.version }}
              label="Close Vacancy Follow-up"
            />
          ) : null}
        </div>
      </Card>
    </>
  );
}
