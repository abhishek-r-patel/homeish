// Render P50.2 locked criteria, private scores and scoring-state controls.
'use client';
import { useId, useState } from 'react';
import {
  saveMajorWorksCriteriaAction,
  saveMajorWorksScoresAction,
  transitionMajorWorksScoringAction,
} from '@/app/(admin)/admin/major-works/actions';
import type { MajorWorksScoring } from '@/core/major-works/validation';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { Button } from '@/components/ui/button';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';

export function MajorWorksCriteriaForm({
  action = saveMajorWorksCriteriaAction,
  refresh = true,
  data,
}: {
  action?: ModuleFormAction;
  refresh?: boolean;
  data: MajorWorksScoring;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [criteria, setCriteria] = useState(
    data.criteria.length
      ? data.criteria.map(({ name, weight }) => ({ name, weight }))
      : [
          { name: '', weight: 60 },
          { name: '', weight: 40 },
        ],
  );
  const weightTotal = criteria.reduce((sum, item) => sum + item.weight, 0);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      refresh={refresh}
      submitDisabled={weightTotal !== 100}
      submitLabel={t('Save scoring criteria')}
      input={() => ({
        projectId: data.project_id,
        criteria,
      })}
    >
      {criteria.map((criterion, index) => (
        <div
          className="grid gap-space-2 medium:grid-cols-[1fr_8rem]"
          key={index}
        >
          <TextInput
            id={`${id}-name-${index}`}
            label={t('Criterion {number}', { number: index + 1 })}
            maxLength={80}
            name={`criterion-${index}-name`}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCriteria((current) =>
                current.map((item, currentIndex) =>
                  currentIndex === index ? { ...item, name: value } : item,
                ),
              );
            }}
            required
            value={criterion.name}
          />
          <TextInput
            id={`${id}-weight-${index}`}
            inputMode="numeric"
            label={t('Weight %')}
            maxLength={3}
            name={`criterion-${index}-weight`}
            onChange={(event) => {
              const value = Number(event.currentTarget.value) || 0;
              setCriteria((current) =>
                current.map((item, currentIndex) =>
                  currentIndex === index ? { ...item, weight: value } : item,
                ),
              );
            }}
            required
            value={String(criterion.weight)}
          />
        </div>
      ))}
      <p className={weightTotal === 100 ? 'text-ink-muted' : 'text-danger'}>
        {t('Weight total: {total}%', { total: weightTotal })}
      </p>
      <div className="flex flex-wrap gap-space-2">
        <Button
          disabled={criteria.length >= 8}
          onClick={() =>
            setCriteria((current) => [...current, { name: '', weight: 0 }])
          }
          type="button"
          variant="secondary"
        >
          {t('Add criterion')}
        </Button>
        <Button
          disabled={criteria.length <= 2}
          onClick={() =>
            setCriteria((current) => current.slice(0, current.length - 1))
          }
          type="button"
          variant="secondary"
        >
          {t('Remove last criterion')}
        </Button>
      </div>
    </ModuleActionForm>
  );
}

export function MajorWorksScoringTransitionForm({
  action = transitionMajorWorksScoringAction,
  refresh = true,
  data,
}: {
  action?: ModuleFormAction;
  refresh?: boolean;
  data: MajorWorksScoring;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [nextAction, setNextAction] = useState('');
  const actions =
    data.scoring_state === 'setup'
      ? ['open', 'not_scored']
      : data.scoring_state === 'open'
        ? ['close']
        : [];
  if (!actions.length) return null;
  return (
    <ModuleActionForm
      action={action}
      confirmMessage={
        nextAction === 'open'
          ? 'Open scoring? Quotes and criteria will lock.'
          : undefined
      }
      submitLabel={t('Update scoring state')}
      input={(form) => ({
        projectId: data.project_id,
        action: nextAction,
        reason: form.get('reason') || '',
        expectedUpdatedAt: data.updated_at,
      })}
      refresh={refresh}
    >
      <SelectInput
        id={`${id}-action`}
        label={t('Scoring action')}
        name="action"
        onChange={(event) => setNextAction(event.currentTarget.value)}
        options={actions.map((value) => ({
          value,
          label:
            value === 'open'
              ? t('Open scoring')
              : value === 'close'
                ? t('Close scoring')
                : t('Mark not scored'),
        }))}
        placeholder={t('Choose action')}
        required
      />
      {nextAction === 'not_scored' ? (
        <TextAreaInput
          id={`${id}-reason`}
          label={t('Reason')}
          maxLength={500}
          minLength={5}
          name="reason"
          required
          rows={2}
        />
      ) : null}
    </ModuleActionForm>
  );
}

export function MajorWorksScoresForm({
  action = saveMajorWorksScoresAction,
  refresh = true,
  data,
}: {
  action?: ModuleFormAction;
  refresh?: boolean;
  data: MajorWorksScoring;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  if (
    data.scoring_state !== 'open' ||
    !data.quotes.length ||
    !data.criteria.length
  ) {
    return null;
  }
  const ownScore = new Map(
    data.my_scores.map((score) => [
      `${score.quote_id}:${score.criterion_id}`,
      String(score.score),
    ]),
  );
  return (
    <ModuleActionForm
      action={action}
      refresh={refresh}
      submitLabel={t('Save private scores')}
      input={(form) => ({
        projectId: data.project_id,
        items: data.quotes
          .filter((quote) => !quote.removed_at && !quote.excluded_at)
          .flatMap((quote) =>
            data.criteria.map((criterion) => ({
              quoteId: quote.id,
              criterionId: criterion.id,
              score: form.get(`score-${quote.id}-${criterion.id}`),
            })),
          ),
      })}
    >
      {data.quotes
        .filter((quote) => !quote.removed_at && !quote.excluded_at)
        .map((quote) => (
          <fieldset
            className="grid gap-space-2 rounded-md border border-rule p-space-3"
            key={quote.id}
          >
            <legend className="px-space-2 font-semibold">
              {quote.vendor_name}
            </legend>
            <div className="grid gap-space-2 medium:grid-cols-2">
              {data.criteria.map((criterion) => (
                <TextInput
                  defaultValue={
                    ownScore.get(`${quote.id}:${criterion.id}`) ?? '0'
                  }
                  id={`${id}-${quote.id}-${criterion.id}`}
                  inputMode="numeric"
                  key={criterion.id}
                  label={t('{criterion} (0 to 10)', {
                    criterion: criterion.name,
                  })}
                  maxLength={2}
                  name={`score-${quote.id}-${criterion.id}`}
                  required
                />
              ))}
            </div>
          </fieldset>
        ))}
    </ModuleActionForm>
  );
}
