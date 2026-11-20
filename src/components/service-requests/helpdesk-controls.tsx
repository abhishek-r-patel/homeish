// Render admin helpdesk controls: priority, hold, feedback follow-up and escalation responses.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import {
  changeServiceRequestPriorityAction,
  holdServiceRequestAction,
  releaseServiceRequestAction,
  respondToServiceRequestEscalationAction,
  setServiceRequestFollowUpAction,
} from '@/app/(resident)/requests/actions';
import { Card } from '@/components/ui/data-display';
import { ServiceRequestActionForm } from './action-form';
import { PRIORITY_OPTIONS } from './priority-field';
import type {
  ServiceRequestEscalationStep,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@/core/service-requests/validation';

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';

const ACTIVE_STATUSES: readonly ServiceRequestStatus[] = [
  'open',
  'assigned',
  'in_progress',
  'reopened',
];

export const ESCALATION_RESPONSE_LABELS = {
  pending_response: 'Pending response',
  action_taken: 'Action taken',
  resolved: 'Resolved',
  further_escalated: 'Further escalated',
} as const;

export function ServiceRequestHelpdeskControls({
  canManage,
  escalations,
  followUp,
  onHold,
  priority,
  rated,
  requestId,
  respondLevels,
  status,
}: {
  canManage: boolean;
  escalations: ServiceRequestEscalationStep[];
  followUp: 'needed' | 'done' | null;
  onHold: boolean;
  priority: ServiceRequestPriority;
  rated: boolean;
  requestId: string;
  respondLevels: ServiceRequestEscalationStep['level'][];
  status: ServiceRequestStatus;
}) {
  const { translate: t } = useUiTranslator();
  const active = ACTIVE_STATUSES.includes(status);
  const respondable = escalations.filter((step) =>
    respondLevels.includes(step.level),
  );

  return (
    <div className="grid gap-space-4">
      {canManage && active ? (
        <Card className="min-w-0" title={t('Change priority')}>
          <ServiceRequestActionForm
            action={changeServiceRequestPriorityAction}
            input={(formData) => ({
              requestId,
              priority: String(formData.get('priority') ?? ''),
              reason: String(formData.get('reason') ?? ''),
            })}
            submitLabel={t('Change priority')}
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="request-priority-change"
            >
              {t('New priority')}
              <select
                className={fieldClass}
                defaultValue={priority}
                id="request-priority-change"
                name="priority"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="grid gap-space-1"
              htmlFor="request-priority-reason"
            >
              {t('Reason')}
              <textarea
                className={fieldClass}
                id="request-priority-reason"
                maxLength={400}
                minLength={2}
                name="reason"
                required
              />
            </label>
          </ServiceRequestActionForm>
        </Card>
      ) : null}
      {canManage && active && !onHold ? (
        <Card
          className="min-w-0"
          description={t(
            'The requester sees this reason. While on hold, the request is not marked overdue or escalated.',
          )}
          title={t('Put on hold')}
        >
          <ServiceRequestActionForm
            action={holdServiceRequestAction}
            input={(formData) => ({
              requestId,
              reason: String(formData.get('reason') ?? ''),
            })}
            submitLabel={t('Put on hold')}
          >
            <label className="grid gap-space-1" htmlFor="request-hold-reason">
              {t('Reason')}
              <textarea
                className={fieldClass}
                id="request-hold-reason"
                maxLength={500}
                minLength={1}
                name="reason"
                required
              />
            </label>
          </ServiceRequestActionForm>
        </Card>
      ) : null}
      {canManage && onHold ? (
        <Card
          className="min-w-0"
          description={t(
            'The target date moves later by the time the request was on hold.',
          )}
          title={t('Release hold')}
        >
          <ServiceRequestActionForm
            action={releaseServiceRequestAction}
            className="inline-grid"
            input={() => ({ requestId })}
            submitLabel={t('Release hold')}
          >
            {null}
          </ServiceRequestActionForm>
        </Card>
      ) : null}
      {canManage && rated ? (
        <Card className="min-w-0" title={t('Feedback follow-up')}>
          <ServiceRequestActionForm
            action={setServiceRequestFollowUpAction}
            input={(formData) => ({
              requestId,
              followUp: String(formData.get('followUp') ?? '') || null,
            })}
            submitLabel={t('Save follow-up')}
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="request-follow-up"
            >
              {t('Follow-up')}
              <select
                className={fieldClass}
                defaultValue={followUp ?? ''}
                id="request-follow-up"
                name="followUp"
              >
                <option value="">{t('Not needed')}</option>
                <option value="needed">{t('Needed')}</option>
                <option value="done">{t('Done')}</option>
              </select>
            </label>
          </ServiceRequestActionForm>
        </Card>
      ) : null}
      {respondable.map((step) => (
        <Card
          className="min-w-0"
          key={step.level}
          title={
            step.level === 'committee'
              ? t('Respond to the committee escalation')
              : t('Respond to the admin escalation')
          }
        >
          <ServiceRequestActionForm
            action={respondToServiceRequestEscalationAction}
            input={(formData) => ({
              requestId,
              level: step.level,
              responseStatus: String(formData.get('responseStatus') ?? ''),
              note: String(formData.get('note') ?? '').trim() || null,
            })}
            submitLabel={t('Save response')}
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor={`escalation-status-${step.level}`}
            >
              {t('Response')}
              <select
                className={fieldClass}
                defaultValue={
                  step.response_status === 'pending_response'
                    ? 'action_taken'
                    : step.response_status
                }
                id={`escalation-status-${step.level}`}
                name="responseStatus"
              >
                <option value="action_taken">{t('Action taken')}</option>
                <option value="resolved">{t('Resolved')}</option>
                <option value="further_escalated">
                  {t('Further escalated')}
                </option>
              </select>
            </label>
            <label
              className="grid gap-space-1"
              htmlFor={`escalation-note-${step.level}`}
            >
              {t('Outcome note (optional)')}
              <textarea
                className={fieldClass}
                defaultValue={step.response_note ?? ''}
                id={`escalation-note-${step.level}`}
                maxLength={1000}
                name="note"
              />
            </label>
          </ServiceRequestActionForm>
        </Card>
      ))}
    </div>
  );
}
