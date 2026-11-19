// Phone-first daily common-area checklist shared by guards, supervisors and admins.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useState } from 'react';
import {
  recordServiceRequestRoundCheckAction,
  saveServiceRequestInspectionPointAction,
} from '@/app/(resident)/requests/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import {
  ServiceRequestActionForm,
  type RequestFormAction,
} from './action-form';
import { PRIORITY_OPTIONS } from './priority-field';
import type {
  ServiceRequestIntakeOptions,
  ServiceRequestRoundsToday,
} from '@/core/service-requests/validation';

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';

type Point = ServiceRequestRoundsToday['points'][number];

function timeOf(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function IssueForm({
  action,
  options,
  point,
}: {
  action: RequestFormAction;
  options: ServiceRequestIntakeOptions;
  point: Point;
}) {
  const { translate: t } = useUiTranslator();
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [follow, setFollow] = useState<'none' | 'raise' | 'link'>('raise');
  return (
    <ServiceRequestActionForm
      action={action}
      buttonSize="guard"
      buttonVariant="destructive"
      input={(formData) => ({
        pointId: point.id,
        result: 'issue',
        note: String(formData.get('note') ?? '').trim() || null,
        action: follow,
        categoryId:
          follow === 'raise'
            ? String(formData.get('categoryId') ?? '') || null
            : null,
        priority:
          follow === 'raise'
            ? String(formData.get('priority') ?? 'medium')
            : null,
        linkRequestId:
          follow === 'link'
            ? String(formData.get('linkRequestId') ?? '') || null
            : null,
        clientRequestId,
      })}
      submitLabel={t('Record issue')}
    >
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`round-note-${point.id}`}
      >
        {t('What is wrong?')}
        <textarea
          className={fieldClass}
          id={`round-note-${point.id}`}
          maxLength={500}
          name="note"
          required
        />
      </label>
      <fieldset className="grid min-w-0 gap-space-2 border-0 p-0">
        <legend className="text-body-strong">{t('Next step')}</legend>
        {(
          [
            ['raise', 'Raise a request'],
            ['link', 'Link an open request'],
            ['none', 'Only record the issue'],
          ] as const
        ).map(([value, label]) => (
          <label className="flex min-h-12 items-center gap-space-2" key={value}>
            <input
              checked={follow === value}
              name={`follow-${point.id}`}
              onChange={() => setFollow(value)}
              type="radio"
              value={value}
            />
            {t(label)}
          </label>
        ))}
      </fieldset>
      {follow === 'raise' ? (
        <>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor={`round-category-${point.id}`}
          >
            {t('Category')}
            <select
              className={fieldClass}
              id={`round-category-${point.id}`}
              name="categoryId"
              required
            >
              <option value="">{t('Choose a category')}</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-space-1 text-body-strong"
            htmlFor={`round-priority-${point.id}`}
          >
            {t('Priority')}
            <select
              className={fieldClass}
              defaultValue="medium"
              id={`round-priority-${point.id}`}
              name="priority"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      {follow === 'link' ? (
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor={`round-link-${point.id}`}
        >
          {t('Open common-area request')}
          <select
            className={fieldClass}
            id={`round-link-${point.id}`}
            name="linkRequestId"
            required
          >
            <option value="">{t('Choose a request')}</option>
            {options.open_common_requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.category} · {request.summary}
              </option>
            ))}
          </select>
          {options.open_common_requests.length === 0 ? (
            <span className="text-caption text-ink-muted">
              {t('There is no open common-area request to link.')}
            </span>
          ) : null}
        </label>
      ) : null}
    </ServiceRequestActionForm>
  );
}

function PointRow({
  action,
  options,
  point,
}: {
  action: RequestFormAction;
  options: ServiceRequestIntakeOptions;
  point: Point;
}) {
  const { translate: t } = useUiTranslator();
  const [okRequestId] = useState(() => crypto.randomUUID());
  const [reporting, setReporting] = useState(false);
  return (
    <li className="grid min-w-0 gap-space-3 rounded-md border border-rule bg-surface p-space-4">
      <div className="grid gap-space-1">
        <p className="text-subheading font-semibold">{point.name}</p>
        {point.location_note ? (
          <p className="text-caption text-ink-muted">{point.location_note}</p>
        ) : null}
      </div>
      {point.check ? (
        <p
          className={`text-body-strong ${point.check.result === 'ok' ? 'text-success' : 'text-danger'}`}
        >
          {point.check.result === 'ok' ? t('OK') : t('Issue')}
          {' · '}
          {t('{name} at {time}', {
            name: point.check.checked_by_name ?? t('Member'),
            time: timeOf(point.check.created_at),
          })}
          {point.check.note ? (
            <span className="block text-body font-normal text-ink">
              {point.check.note}
            </span>
          ) : null}
        </p>
      ) : reporting ? (
        <div className="grid gap-space-3">
          <IssueForm action={action} options={options} point={point} />
          <Button
            onClick={() => setReporting(false)}
            size="guard"
            variant="secondary"
          >
            {t('Cancel')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-space-3">
          <ServiceRequestActionForm
            action={action}
            buttonSize="guard"
            buttonVariant="success"
            className="grid"
            input={() => ({
              pointId: point.id,
              result: 'ok',
              note: null,
              action: 'none',
              categoryId: null,
              priority: null,
              linkRequestId: null,
              clientRequestId: okRequestId,
            })}
            submitLabel={t('OK')}
          >
            {null}
          </ServiceRequestActionForm>
          <Button
            onClick={() => setReporting(true)}
            size="guard"
            variant="destructive"
          >
            {t('Issue')}
          </Button>
        </div>
      )}
    </li>
  );
}

export function ServiceRequestRoundsChecklist({
  action = recordServiceRequestRoundCheckAction,
  options,
  today,
}: {
  action?: RequestFormAction;
  options: ServiceRequestIntakeOptions;
  today: ServiceRequestRoundsToday;
}) {
  const { translate: t } = useUiTranslator();
  const points = today.points.filter((point) => point.active);
  const done = points.filter((point) => point.check).length;
  return (
    <section className="grid min-w-0 gap-space-4">
      <p className="text-body text-ink-muted">
        {t('{done} of {total} points checked today', {
          done,
          total: points.length,
        })}
      </p>
      {points.length === 0 ? (
        <Card title={t('No check points yet')}>
          <p className="text-body text-ink-muted">
            {t('An admin adds the points to check each day.')}
          </p>
        </Card>
      ) : (
        <ul className="grid gap-space-3">
          {points.map((point) => (
            <PointRow
              action={action}
              key={point.id}
              options={options}
              point={point}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PointForm({
  action,
  point,
}: {
  action: RequestFormAction;
  point?: Point;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ServiceRequestActionForm
      action={action}
      input={(formData) => ({
        id: point?.id ?? null,
        name: String(formData.get('name') ?? ''),
        locationNote: String(formData.get('locationNote') ?? '').trim() || null,
        sortOrder: Number(formData.get('sortOrder') ?? 0),
        active: formData.has('active'),
      })}
      submitLabel={point ? t('Save point') : t('Add point')}
    >
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        {t('Name')}
        <input
          className={fieldClass}
          defaultValue={point?.name ?? ''}
          maxLength={120}
          name="name"
          required
        />
      </label>
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        {t('Where to find it (optional)')}
        <input
          className={fieldClass}
          defaultValue={point?.location_note ?? ''}
          maxLength={200}
          name="locationNote"
        />
      </label>
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        {t('Display order')}
        <input
          className={fieldClass}
          defaultValue={point?.sort_order ?? 0}
          max={9999}
          min={0}
          name="sortOrder"
          required
          type="number"
        />
      </label>
      <label className="flex min-h-10 items-center gap-space-2">
        <input
          defaultChecked={point?.active ?? true}
          name="active"
          type="checkbox"
        />
        {t('Active')}
      </label>
    </ServiceRequestActionForm>
  );
}

export function ServiceRequestInspectionPointManager({
  action = saveServiceRequestInspectionPointAction,
  points,
}: {
  action?: RequestFormAction;
  points: Point[];
}) {
  const { translate: t } = useUiTranslator();
  return (
    <div className="grid gap-space-4">
      <Card className="min-w-0" title={t('Add a check point')}>
        <PointForm action={action} />
      </Card>
      {points.map((point) => (
        <Card className="min-w-0" key={point.id} title={point.name}>
          <PointForm action={action} point={point} />
        </Card>
      ))}
    </div>
  );
}
