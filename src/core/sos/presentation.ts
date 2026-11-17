// Present emergency alerts, responder choices and tap-to-call contacts.
import { formatLocalizedDateTime } from '../i18n/format';
import type { Locale } from '../i18n/locale';
import { translateMessage } from '../i18n/messages';
import type {
  SosAlert,
  SosBannerAlert,
  SosCategory,
  SosCloseReason,
  SosResidentScope,
  SosStatus,
} from './validation';

export const SOS_CATEGORY_LABELS: Record<SosCategory, string> = {
  medical: 'Medical',
  fire: 'Fire',
  security: 'Security',
  other: 'Other emergency',
};

export const SOS_STATUS_LABELS: Record<SosStatus, string> = {
  raised: 'Raised',
  acknowledged: 'Acknowledged',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const SOS_CLOSE_REASON_LABELS: Record<
  SosCloseReason | 'raised_by_mistake',
  string
> = {
  resolved: 'Resolved',
  false_alarm: 'False alarm',
  duplicate: 'Duplicate',
  test: 'Test',
  other: 'Other',
  raised_by_mistake: 'Raised by mistake',
};

export const SOS_EVENT_LABELS: Record<
  SosAlert['events'][number]['action'],
  string
> = {
  raised: 'SOS raised',
  acknowledged: 'Acknowledged by a responder',
  updated: 'Responder update',
  closed: 'Closed',
  cancelled: 'Cancelled by the raiser',
};

export const SOS_SCOPE_LABELS: Record<SosResidentScope, string> = {
  off: 'No residents',
  floor: 'Residents on the same floor and block',
  block: 'Residents in the same block',
  society: 'All residents in the society',
};

export const SOS_EMERGENCY_NOTICE =
  'Homeish is not a replacement for emergency services. In a life-threatening emergency, call 112 first.';

export function sosTelHref(phone: string) {
  return `tel:${phone.replace(/[\s-]/g, '')}`;
}

export function isSosOpen(status: SosStatus) {
  return status === 'raised' || status === 'acknowledged';
}

export function sosRecipientSummary(
  settings: {
    notify_guards: boolean;
    notify_admins: boolean;
    notify_committee: boolean;
    resident_scope: SosResidentScope;
  },
  locale: Locale = 'en',
) {
  const t = (source: string) => translateMessage(locale, source);
  const groups = [
    settings.notify_guards && 'guards',
    settings.notify_admins && 'admins',
    settings.notify_committee && 'committee members',
  ].filter((group): group is string => Boolean(group));
  if (settings.resident_scope === 'floor')
    groups.push('residents on your floor');
  if (settings.resident_scope === 'block')
    groups.push('residents in your block');
  if (settings.resident_scope === 'society') groups.push('all residents');
  if (groups.length === 0) return t('No one is set up to be notified.');
  const last = t(groups.pop()!);
  const recipients = groups.length
    ? translateMessage(locale, '{groups} and {last}', {
        groups: groups.map(t).join(', '),
        last,
      })
    : last;
  return translateMessage(locale, 'Notifies {recipients}.', { recipients });
}

export function sosBannerTitle(alert: SosBannerAlert, locale: Locale = 'en') {
  const where = alert.unit_label
    ? translateMessage(locale, 'unit {unit}', { unit: alert.unit_label })
    : alert.raised_role === 'guard'
      ? translateMessage(locale, 'the gate')
      : translateMessage(locale, 'a resident');
  return translateMessage(locale, '{category} SOS from {where}', {
    category: translateMessage(locale, SOS_CATEGORY_LABELS[alert.category]),
    where,
  });
}

export function formatSosTimestamp(
  value: string,
  timeZone?: string,
  locale: Locale = 'en',
) {
  return formatLocalizedDateTime(new Date(value), locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(timeZone ? { timeZone } : {}),
  });
}
