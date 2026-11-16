// Compose and deliver escalation emails without letting mail problems stop the daily job.
import type {
  EmailDeliveryResult,
  TransactionalEmail,
} from '../notifications/email';
import type { ServiceRequestEscalationLevel } from './validation';

export type ServiceRequestEscalationEmail = {
  email: string;
  name: string | null;
  level: Exclude<ServiceRequestEscalationLevel, 'none'>;
  request_id: string;
  request_label: string;
};

export type EscalationEmailOutcome = {
  sent: number;
  failed: number;
  skipped: number;
};

const levelLabels = {
  admin: 'the society admins',
  committee: 'the management committee',
} as const;

export function buildServiceRequestEscalationEmail(
  recipient: ServiceRequestEscalationEmail,
): TransactionalEmail {
  const label = recipient.request_label.slice(0, 120);
  const name = recipient.name?.trim().slice(0, 120);
  return {
    to: { email: recipient.email, ...(name ? { name } : {}) },
    subject: `Service request escalated: ${label}`,
    textContent: [
      `Hello${name ? ` ${name}` : ''},`,
      '',
      `The service request "${label}" is past its response target and was escalated to ${levelLabels[recipient.level]}.`,
      '',
      'Sign in to Homeish and open Service requests to review it.',
    ].join('\n'),
  };
}

// Stops at the daily quota and swallows provider errors; the in-app record is already saved.
export async function deliverServiceRequestEscalationEmails(
  recipients: readonly ServiceRequestEscalationEmail[],
  send: (message: TransactionalEmail) => Promise<EmailDeliveryResult>,
): Promise<EscalationEmailOutcome> {
  const outcome: EscalationEmailOutcome = { sent: 0, failed: 0, skipped: 0 };
  for (const [index, recipient] of recipients.entries()) {
    let result: EmailDeliveryResult;
    try {
      result = await send(buildServiceRequestEscalationEmail(recipient));
    } catch {
      outcome.failed += 1;
      continue;
    }
    if (result.sent) {
      outcome.sent += 1;
      continue;
    }
    if (result.reason === 'quota' || result.reason === 'not_configured') {
      outcome.skipped += recipients.length - index;
      break;
    }
    outcome.failed += 1;
  }
  return outcome;
}
