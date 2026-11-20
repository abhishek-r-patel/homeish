// Admin official planning fields and committee proposals, never shown to residents.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useRef, useState } from 'react';
import { Banner } from '@/components/ui/feedback';
import {
  saveNoticePlanAction,
  proposeNoticePlanAction,
  reviewNoticePlanAction,
} from '@/app/(admin)/admin/notices/actions';
import {
  NOTICE_DISPLAY_LOCATION_MAX,
  NOTICE_NEXT_ACTION_MAX,
  NOTICE_PREPARED_BY_MAX,
  type NoticePlan,
  type NoticePlanProposal,
} from '@/core/notices/validation';
import { NoticeActionForm, type NoticeFormAction } from './action-form';

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim();
  return value ? value : null;
}

export function NoticePlanForm({
  action,
  noticeId,
  plan,
  proposal = false,
}: {
  /** Overrides the server action; fixtures pass an in-memory action. */
  action?: NoticeFormAction;
  noticeId: string;
  plan: NoticePlan | null;
  proposal?: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const retryId = useRef<string | null>(null);
  return (
    <NoticeActionForm
      action={
        action ?? (proposal ? proposeNoticePlanAction : saveNoticePlanAction)
      }
      input={(formData) => {
        const priority = String(formData.get('priority') ?? '');
        return {
          ...(proposal
            ? { clientRequestId: (retryId.current ??= crypto.randomUUID()) }
            : {}),
          noticeId,
          preparedBy: text(formData, 'preparedBy'),
          displayLocation: text(formData, 'displayLocation'),
          priority: priority === '' ? null : priority,
          nextAction: text(formData, 'nextAction'),
          nextActionOn: text(formData, 'nextActionOn'),
        };
      }}
      onSuccess={() => {
        retryId.current = null;
      }}
      submitLabel={
        proposal ? t('Propose planning details') : t('Save planning details')
      }
      submitVariant="secondary"
    >
      <p className="text-caption text-ink-muted">
        {proposal
          ? t(
              'An admin must accept your proposal before the official planning details change.',
            )
          : t('Only admins and committee members see these details.')}
      </p>
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-prepared-by"
      >
        {t('Prepared by (optional)')}
        <input
          className={fieldClass}
          defaultValue={plan?.prepared_by ?? ''}
          id="notice-prepared-by"
          maxLength={NOTICE_PREPARED_BY_MAX}
          name="preparedBy"
        />
      </label>
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-display-location"
      >
        {t('Notice board location (optional)')}
        <input
          className={fieldClass}
          defaultValue={plan?.display_location ?? ''}
          id="notice-display-location"
          maxLength={NOTICE_DISPLAY_LOCATION_MAX}
          name="displayLocation"
          placeholder={t('For example, lift lobby of Block A')}
        />
      </label>
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-priority"
      >
        {t('Priority (optional)')}
        <select
          className={fieldClass}
          defaultValue={plan?.priority ?? ''}
          id="notice-priority"
          name="priority"
        >
          <option value="">{t('Not set')}</option>
          <option value="high">{t('High')}</option>
          <option value="medium">{t('Medium')}</option>
          <option value="low">{t('Low')}</option>
        </select>
      </label>
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-next-action"
      >
        {t('Next action (optional)')}
        <input
          className={fieldClass}
          defaultValue={plan?.next_action ?? ''}
          id="notice-next-action"
          maxLength={NOTICE_NEXT_ACTION_MAX}
          name="nextAction"
          placeholder={t('For example, take down the paper copy')}
        />
      </label>
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-next-action-on"
      >
        {t('Next action date (optional)')}
        <input
          className={fieldClass}
          defaultValue={plan?.next_action_on ?? ''}
          id="notice-next-action-on"
          name="nextActionOn"
          type="date"
        />
      </label>
    </NoticeActionForm>
  );
}

export function NoticePlanProposals({
  proposals,
  canReview,
  action,
}: {
  proposals: readonly NoticePlanProposal[];
  canReview: boolean;
  action?: NoticeFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  return (
    <section className="grid gap-space-3" aria-label={t('Planning proposals')}>
      <h2 className="text-heading font-semibold">{t('Planning proposals')}</h2>
      {savedMessage ? <Banner tone="success">{t(savedMessage)}</Banner> : null}
      {proposals.length === 0 ? (
        <p>{t('No planning proposals yet.')}</p>
      ) : (
        <ul className="grid gap-space-3">
          {proposals.map((proposal) => (
            <li
              key={proposal.id}
              className="grid gap-space-3 rounded-md border border-rule p-space-4"
            >
              <p>
                {proposal.proposed_by_name ?? t('Former member')} ·{' '}
                {t(
                  proposal.status === 'pending'
                    ? 'Pending review'
                    : proposal.status === 'accepted'
                      ? 'Accepted'
                      : 'Rejected',
                )}
              </p>
              <dl className="grid gap-space-2">
                {[
                  [t('Prepared by:'), proposal.prepared_by],
                  [t('Notice board location:'), proposal.display_location],
                  [
                    t('Priority:'),
                    proposal.priority
                      ? t(
                          proposal.priority === 'high'
                            ? 'High'
                            : proposal.priority === 'medium'
                              ? 'Medium'
                              : 'Low',
                        )
                      : null,
                  ],
                  [t('Next action:'), proposal.next_action],
                  [t('Next action date:'), proposal.next_action_on],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-body-strong">{label}</dt>
                    <dd>{value ?? t('Not set')}</dd>
                  </div>
                ))}
              </dl>
              {canReview && proposal.status === 'pending' ? (
                <div className="grid gap-space-3 medium:grid-cols-2">
                  {[true, false].map((accept) => (
                    <NoticeActionForm
                      key={String(accept)}
                      action={action ?? reviewNoticePlanAction}
                      input={() => ({
                        noticeId: proposal.notice_id,
                        proposalId: proposal.id,
                        accept,
                      })}
                      onSuccess={() =>
                        setSavedMessage(
                          accept
                            ? 'Proposal accepted. The official planning details were updated.'
                            : 'Proposal rejected. The official planning details are unchanged.',
                        )
                      }
                      submitLabel={
                        accept ? t('Accept proposal') : t('Reject proposal')
                      }
                      confirmMessage={
                        accept
                          ? t(
                              'Accept this proposal and replace the official planning details?',
                            )
                          : t('Reject this planning proposal?')
                      }
                      submitVariant="secondary"
                    />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
