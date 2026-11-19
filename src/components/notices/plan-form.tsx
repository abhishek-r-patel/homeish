// Admin and committee planning fields kept beside a notice (never shown to residents).
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { saveNoticePlanAction } from '@/app/(admin)/admin/notices/actions';
import {
  NOTICE_DISPLAY_LOCATION_MAX,
  NOTICE_NEXT_ACTION_MAX,
  NOTICE_PREPARED_BY_MAX,
  type NoticePlan,
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
}: {
  /** Overrides the server action; fixtures pass an in-memory action. */
  action?: NoticeFormAction;
  noticeId: string;
  plan: NoticePlan | null;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <NoticeActionForm
      action={action ?? saveNoticePlanAction}
      input={(formData) => {
        const priority = String(formData.get('priority') ?? '');
        return {
          noticeId,
          preparedBy: text(formData, 'preparedBy'),
          displayLocation: text(formData, 'displayLocation'),
          priority: priority === '' ? null : priority,
          nextAction: text(formData, 'nextAction'),
          nextActionOn: text(formData, 'nextActionOn'),
        };
      }}
      submitLabel={t('Save planning details')}
      submitVariant="secondary"
    >
      <p className="text-caption text-ink-muted">
        {t('Only admins and committee members see these details.')}
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
