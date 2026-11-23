// Manage P46 advisory schedule, helpers, source links and linked costs.
'use client';

import { useState } from 'react';
import {
  linkPollElectionExpenseAction,
  linkPollElectionSourceAction,
  savePollElectionActivitiesAction,
  savePollElectionHelpersAction,
  unlinkPollElectionSourceAction,
} from '@/app/(admin)/admin/polls/elections/actions';
import { Button } from '@/components/ui/button';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

export function PollElectionScheduleForm({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  const [activities, setActivities] = useState(
    election.activities.map((activity) => ({
      title: activity.title,
      ownerName: activity.owner_name ?? '',
      plannedOn: activity.planned_on ?? '',
      actualOn: activity.actual_on ?? '',
      status: activity.status,
      note: activity.note ?? '',
    })),
  );
  return (
    <ModuleActionForm
      action={savePollElectionActivitiesAction}
      submitLabel={t('Save schedule')}
      input={() => ({ electionId: election.id, activities })}
    >
      <p className="text-caption text-ink-muted">
        {t('Planned dates — not legal deadlines')}
      </p>
      {activities.map((activity, index) => (
        <div
          key={index}
          className="grid gap-space-3 rounded-md border border-rule p-space-3"
        >
          <TextInput
            id={`activity-${index}-title`}
            label={t('Activity')}
            required
            value={activity.title}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setActivities((rows) =>
                rows.map((row, rowIndex) =>
                  rowIndex === index ? { ...row, title: value } : row,
                ),
              );
            }}
          />
          <TextInput
            id={`activity-${index}-owner`}
            label={t('Owner')}
            value={activity.ownerName}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setActivities((rows) =>
                rows.map((row, rowIndex) =>
                  rowIndex === index ? { ...row, ownerName: value } : row,
                ),
              );
            }}
          />
          <SelectInput
            id={`activity-${index}-status`}
            label={t('Status')}
            value={activity.status}
            onChange={(event) => {
              const value = event.currentTarget.value as
                'to_do' | 'done' | 'not_needed';
              setActivities((rows) =>
                rows.map((row, rowIndex) =>
                  rowIndex === index ? { ...row, status: value } : row,
                ),
              );
            }}
            options={[
              { value: 'to_do', label: t('To do') },
              { value: 'done', label: t('Done') },
              { value: 'not_needed', label: t('Not needed') },
            ]}
          />
        </div>
      ))}
      <Button
        variant="secondary"
        type="button"
        onClick={() =>
          setActivities((rows) => [
            ...rows,
            {
              title: '',
              ownerName: '',
              plannedOn: '',
              actualOn: '',
              status: 'to_do',
              note: '',
            },
          ])
        }
      >
        {t('Add activity')}
      </Button>
    </ModuleActionForm>
  );
}

export function PollElectionHelpersForm({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={savePollElectionHelpersAction}
      submitLabel={t('Save assistants and observers')}
      input={(data) => ({
        electionId: election.id,
        helpers: [
          {
            name: data.get('helperName') ?? '',
            role: data.get('helperRole') ?? '',
          },
        ].filter((helper) => String(helper.name).trim()),
      })}
    >
      <TextInput
        id="helper-name"
        name="helperName"
        label={t('Name')}
        maxLength={120}
      />
      <TextInput
        id="helper-role"
        name="helperRole"
        label={t('Role')}
        maxLength={80}
      />
    </ModuleActionForm>
  );
}

export function PollElectionSourceForm({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  const options = [
    ...election.source_options.notices.map((item) => ({
      value: `notice:${item.id}`,
      label: `${t('Notice')} · ${item.title}`,
    })),
    ...election.source_options.meetings.map((item) => ({
      value: `meeting:${item.id}`,
      label: `${t('Meeting')} · ${item.title}`,
    })),
    ...election.source_options.documents.map((item) => ({
      value: `document:${item.id}`,
      label: `${t('Document')} · ${item.title}`,
    })),
  ];
  return (
    <>
      {options.length ? (
        <ModuleActionForm
          action={linkPollElectionSourceAction}
          submitLabel={t('Link source')}
          idempotent
          input={(data) => {
            const [sourceType, sourceId] = String(data.get('source')).split(
              ':',
            );
            return { electionId: election.id, sourceType, sourceId };
          }}
        >
          <SelectInput
            id="election-source"
            name="source"
            label={t('Notice, meeting or document')}
            options={options}
          />
        </ModuleActionForm>
      ) : (
        <p>{t('No enabled source records are available.')}</p>
      )}
      <ul className="grid gap-space-2">
        {election.links.map((link) => (
          <li
            key={link.id}
            className="flex items-center justify-between gap-space-3"
          >
            <span>{link.title ?? link.source_type}</span>
            <ModuleActionForm
              action={unlinkPollElectionSourceAction}
              submitLabel={t('Remove')}
              input={() => ({ linkId: link.id })}
            >
              <span>{t('Remove')}</span>
            </ModuleActionForm>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PollElectionExpenseForm({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  return election.expense_options.length ? (
    <ModuleActionForm
      action={linkPollElectionExpenseAction}
      submitLabel={t('Link posted expense')}
      input={(data) => ({
        electionId: election.id,
        expenseId: data.get('expenseId'),
      })}
    >
      <SelectInput
        id="election-expense"
        name="expenseId"
        label={t('Posted Accounts entry')}
        options={election.expense_options.map((expense) => ({
          value: expense.id,
          label: expense.label,
        }))}
      />
    </ModuleActionForm>
  ) : (
    <p>{t('No posted Accounts expenses are available.')}</p>
  );
}
