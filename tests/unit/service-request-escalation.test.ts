// Verify escalation email wording, quota handling and failure tolerance.
import { describe, expect, it, vi } from 'vitest';
import {
  buildServiceRequestEscalationEmail,
  deliverServiceRequestEscalationEmails,
  type ServiceRequestEscalationEmail,
} from '../../src/core/service-requests/escalation';
import {
  serviceRequestCategoryInputSchema,
  serviceRequestEscalationSettingsInputSchema,
} from '../../src/core/service-requests/validation';

function recipient(
  index: number,
  level: 'admin' | 'committee' = 'admin',
): ServiceRequestEscalationEmail {
  return {
    email: `member-${index}@example.test`,
    name: `Synthetic member ${index}`,
    level,
    request_id: '6a696d6f-774c-41d1-ae47-6254d4a8f4cf',
    request_label: 'Plumbing · Unit A-101',
  };
}

describe('service request escalation email', () => {
  it('names the level without request details or other recipients', () => {
    const message = buildServiceRequestEscalationEmail(
      recipient(1, 'committee'),
    );
    expect(message.to).toEqual({
      email: 'member-1@example.test',
      name: 'Synthetic member 1',
    });
    expect(message.subject).toBe(
      'Service request escalated: Plumbing · Unit A-101',
    );
    expect(message.textContent).toContain(
      'was escalated to the management committee',
    );
    expect(message.textContent).not.toContain('member-2');
  });

  it('stops at the daily quota and counts the rest as skipped', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: 'quota' });
    const outcome = await deliverServiceRequestEscalationEmails(
      [recipient(1), recipient(2), recipient(3)],
      send,
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ sent: 1, failed: 0, skipped: 2 });
  });

  it('keeps going after provider failures and thrown errors', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ sent: false, reason: 'provider' })
      .mockResolvedValueOnce({ sent: true });
    const outcome = await deliverServiceRequestEscalationEmails(
      [recipient(1), recipient(2), recipient(3)],
      send,
    );
    expect(outcome).toEqual({ sent: 1, failed: 2, skipped: 0 });
  });
});

describe('service request escalation inputs', () => {
  const category = {
    id: null,
    name: 'Plumbing',
    slaHours: 24,
    sortOrder: 0,
    active: true,
    expectedUpdatedAt: null,
  };

  it('accepts committee intervals from 1 to 30 days', () => {
    for (const days of [1, 30]) {
      expect(
        serviceRequestCategoryInputSchema.safeParse({
          ...category,
          committeeEscalationDays: days,
        }).success,
      ).toBe(true);
    }
    for (const days of [0, 31, 1.5]) {
      expect(
        serviceRequestCategoryInputSchema.safeParse({
          ...category,
          committeeEscalationDays: days,
        }).success,
      ).toBe(false);
    }
  });

  it('accepts only the supported delivery choices', () => {
    for (const delivery of ['in_app', 'in_app_email']) {
      expect(
        serviceRequestEscalationSettingsInputSchema.safeParse({
          delivery,
          expectedUpdatedAt: null,
        }).success,
      ).toBe(true);
    }
    for (const delivery of ['email', 'both', 'sms']) {
      expect(
        serviceRequestEscalationSettingsInputSchema.safeParse({
          delivery,
          expectedUpdatedAt: null,
        }).success,
      ).toBe(false);
    }
  });
});
