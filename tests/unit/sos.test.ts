import { describe, expect, it } from 'vitest';
import {
  sosBannerTitle,
  sosRecipientSummary,
  sosTelHref,
} from '../../src/core/sos/presentation';
import {
  sosBannerAlertSchema,
  sosCloseInputSchema,
  sosContactInputSchema,
  sosRaiseInputSchema,
  sosSettingsInputSchema,
} from '../../src/core/sos/validation';

const ALERT_ID = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const UNIT_ID = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';

describe('SOS validation', () => {
  it('requires a close note only for false alarms and other reasons', () => {
    for (const reason of ['false_alarm', 'other'] as const) {
      expect(
        sosCloseInputSchema.safeParse({ alertId: ALERT_ID, reason, note: ' ' })
          .success,
      ).toBe(false);
      expect(
        sosCloseInputSchema.safeParse({
          alertId: ALERT_ID,
          reason,
          note: 'Smoke from cooking',
        }).success,
      ).toBe(true);
    }
    for (const reason of ['resolved', 'duplicate', 'test'] as const) {
      expect(
        sosCloseInputSchema.parse({ alertId: ALERT_ID, reason, note: '' }).note,
      ).toBeNull();
    }
  });

  it('bounds the raise note and stores a blank note as null', () => {
    const base = {
      unitId: UNIT_ID,
      category: 'medical',
      clientRequestId: ALERT_ID,
    };
    expect(sosRaiseInputSchema.parse({ ...base, note: '   ' }).note).toBeNull();
    expect(
      sosRaiseInputSchema.safeParse({ ...base, note: 'x'.repeat(281) }).success,
    ).toBe(false);
    expect(
      sosRaiseInputSchema.safeParse({ ...base, category: 'flood', note: null })
        .success,
    ).toBe(false);
  });

  it('accepts dialable contact numbers only', () => {
    const contact = { contactId: null, label: 'Ambulance', sortOrder: 10 };
    for (const phone of ['108', '+91 98765-43210'])
      expect(
        sosContactInputSchema.safeParse({ ...contact, phone }).success,
      ).toBe(true);
    for (const phone of ['10a', '-108', '108-', '++91'])
      expect(
        sosContactInputSchema.safeParse({ ...contact, phone }).success,
      ).toBe(false);
  });

  it('keeps at least one responder group notified', () => {
    const settings = {
      notifyGuards: false,
      notifyAdmins: false,
      notifyCommittee: false,
      residentScope: 'society',
    };
    expect(sosSettingsInputSchema.safeParse(settings).success).toBe(false);
    expect(
      sosSettingsInputSchema.safeParse({ ...settings, notifyCommittee: true })
        .success,
    ).toBe(true);
  });
});

describe('SOS presentation', () => {
  it('builds tap-to-call links without separators', () => {
    expect(sosTelHref('+91 98765-43210')).toBe('tel:+919876543210');
  });

  it('summarises recipients from settings', () => {
    expect(
      sosRecipientSummary({
        notify_guards: true,
        notify_admins: true,
        notify_committee: false,
        resident_scope: 'off',
      }),
    ).toBe('Notifies guards and admins.');
    expect(
      sosRecipientSummary({
        notify_guards: false,
        notify_admins: false,
        notify_committee: true,
        resident_scope: 'floor',
      }),
    ).toBe('Notifies committee members and residents on your floor.');
  });

  it('describes where a banner alert came from', () => {
    const alert = sosBannerAlertSchema.parse({
      id: ALERT_ID,
      society_id: UNIT_ID,
      society_name: 'Lakeview',
      category: 'fire',
      status: 'raised',
      raised_role: 'guard',
      unit_label: null,
      raised_at: '2026-11-15T10:00:00Z',
      audience: 'resident',
      note: null,
    });
    expect(sosBannerTitle(alert)).toBe('Fire SOS from the gate');
    expect(sosBannerTitle({ ...alert, unit_label: 'A-101' })).toBe(
      'Fire SOS from unit A-101',
    );
  });
});
