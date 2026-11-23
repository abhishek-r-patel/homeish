// Render P46 official-election settings, editor and lifecycle controls.
'use client';

import { useId, useState } from 'react';
import {
  savePollElectionAction,
  setPollOfficialVotingAction,
  updatePollElectionSettingsAction,
} from '@/app/(admin)/admin/polls/elections/actions';
import { Button } from '@/components/ui/button';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { POLL_OFFICIAL_CONFIRMATION } from '@/core/poll/election-inputs';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

export function PollOfficialVotingForm({
  settings,
  action = setPollOfficialVotingAction,
  refresh = true,
}: {
  settings: {
    official_voting_enabled: boolean;
    official_legal_type: 'apartment_association' | 'cooperative' | null;
  };
  action?: ModuleFormAction;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [enabled, setEnabled] = useState(settings.official_voting_enabled);
  return (
    <ModuleActionForm
      action={action}
      refresh={refresh}
      idempotent
      submitLabel={t('Save official voting setting')}
      input={(data) => ({
        enabled,
        legalType: enabled ? data.get('legalType') : null,
        confirmation: enabled ? data.get('confirmation') : null,
      })}
    >
      <CheckboxInput
        id={`${id}-enabled`}
        label={t('Enable official committee elections')}
        checked={enabled}
        onChange={(event) => setEnabled(event.currentTarget.checked)}
      />
      {enabled ? (
        <>
          <SelectInput
            id={`${id}-legal`}
            name="legalType"
            label={t('Society legal type')}
            required
            defaultValue={settings.official_legal_type ?? ''}
            options={[
              {
                value: 'apartment_association',
                label: t('Apartment association'),
              },
              { value: 'cooperative', label: t('Housing co-operative') },
            ]}
          />
          <CheckboxInput
            id={`${id}-confirm`}
            name="confirmation"
            value={POLL_OFFICIAL_CONFIRMATION}
            label={t(POLL_OFFICIAL_CONFIRMATION)}
            required
          />
          <p className="text-caption text-ink-muted">
            {t(
              'Homeish records this accepted-risk confirmation. It does not verify the society’s law, bye-laws or authority.',
            )}
          </p>
        </>
      ) : null}
    </ModuleActionForm>
  );
}

export function PollElectionSettingsForm({
  settings,
}: {
  settings: {
    dispute_window_days: number;
    nomination_supporters_enabled: boolean;
    multi_post_win_rule: 'candidate_choice' | 'returning_officer';
    updated_at: string;
  };
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={updatePollElectionSettingsAction}
      submitLabel={t('Save election defaults')}
      input={(data) => ({
        disputeWindowDays: Number(data.get('disputeWindowDays')),
        nominationSupportersEnabled:
          data.get('nominationSupportersEnabled') === 'on',
        multiPostWinRule: data.get('multiPostWinRule'),
        expectedUpdatedAt: settings.updated_at,
      })}
    >
      <TextInput
        id={`${id}-window`}
        name="disputeWindowDays"
        label={t('Dispute window (days)')}
        type="number"
        min={1}
        max={30}
        defaultValue={settings.dispute_window_days}
      />
      <CheckboxInput
        id={`${id}-supporters`}
        name="nominationSupportersEnabled"
        label={t('Allow proposer and seconder confirmations')}
        defaultChecked={settings.nomination_supporters_enabled}
      />
      <SelectInput
        id={`${id}-wins`}
        name="multiPostWinRule"
        label={t('When one candidate wins several posts')}
        defaultValue={settings.multi_post_win_rule}
        options={[
          {
            value: 'candidate_choice',
            label: t('Candidate chooses within 3 days'),
          },
          { value: 'returning_officer', label: t('Returning officer decides') },
        ]}
      />
    </ModuleActionForm>
  );
}

export function PollElectionEditorForm({
  election,
  action = savePollElectionAction,
  refresh = true,
}: {
  election?: PollElectionDetail;
  action?: ModuleFormAction;
  refresh?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [posts, setPosts] = useState(
    election?.posts.map((post) => ({
      name: post.name,
      seats: post.seats,
    })) ?? [{ name: '', seats: 1 }],
  );
  return (
    <ModuleActionForm
      action={action}
      refresh={refresh}
      idempotent
      submitLabel={
        election ? t('Save election') : t('Create official election')
      }
      input={(data) => ({
        electionId: election?.id ?? null,
        title: data.get('title'),
        nominationsOpenAt: data.get('nominationsOpenAt')
          ? new Date(String(data.get('nominationsOpenAt'))).toISOString()
          : null,
        nominationsCloseAt: data.get('nominationsCloseAt')
          ? new Date(String(data.get('nominationsCloseAt'))).toISOString()
          : null,
        votingOpensAt: data.get('votingOpensAt')
          ? new Date(String(data.get('votingOpensAt'))).toISOString()
          : null,
        votingClosesAt: data.get('votingClosesAt')
          ? new Date(String(data.get('votingClosesAt'))).toISOString()
          : null,
        posts,
        expectedRevision: election?.revision ?? null,
      })}
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label={t('Election title')}
        maxLength={150}
        required
        defaultValue={election?.title}
      />
      <TextInput
        id={`${id}-nom-open`}
        name="nominationsOpenAt"
        label={t('Nominations open')}
        type="datetime-local"
        defaultValue={election?.nominations_open_at?.slice(0, 16) ?? ''}
      />
      <TextInput
        id={`${id}-nom-close`}
        name="nominationsCloseAt"
        label={t('Nominations close')}
        type="datetime-local"
        defaultValue={election?.nominations_close_at?.slice(0, 16) ?? ''}
      />
      <TextInput
        id={`${id}-vote-open`}
        name="votingOpensAt"
        label={t('Voting opens')}
        type="datetime-local"
        defaultValue={election?.voting_opens_at?.slice(0, 16) ?? ''}
      />
      <TextInput
        id={`${id}-vote-close`}
        name="votingClosesAt"
        label={t('Voting closes')}
        type="datetime-local"
        defaultValue={election?.voting_closes_at?.slice(0, 16) ?? ''}
      />
      <div className="grid gap-space-3">
        <h3 className="font-semibold">{t('Posts and seats')}</h3>
        {posts.map((post, index) => (
          <div
            className="grid gap-space-3 rounded-md border border-rule p-space-3 medium:grid-cols-[1fr_8rem_auto]"
            key={index}
          >
            <TextInput
              id={`${id}-post-${index}`}
              name={`post-${index}`}
              label={t('Post name')}
              required
              value={post.name}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPosts((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, name: value } : row,
                  ),
                );
              }}
            />
            <TextInput
              id={`${id}-seats-${index}`}
              name={`seats-${index}`}
              label={t('Seats')}
              type="number"
              min={1}
              max={50}
              value={post.seats}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                setPosts((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, seats: value } : row,
                  ),
                );
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setPosts((current) =>
                  current.filter((_, rowIndex) => rowIndex !== index),
                )
              }
              disabled={posts.length === 1}
            >
              {t('Remove post')}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setPosts((current) => [...current, { name: '', seats: 1 }])
          }
        >
          {t('Add post')}
        </Button>
      </div>
    </ModuleActionForm>
  );
}
