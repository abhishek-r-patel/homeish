// Turn admin home records into display labels and links without exposing anything the feed does not carry.
import type { AdminActivityItem } from './admin-validation';

// Keep in step with the allow-list in admin_home_admin_actions (DATABASE §3.13).
export const ADMIN_ACTION_LABELS = {
  'billing.payment.confirm': 'Payment confirmed',
  'billing.payment.reject': 'Payment rejected',
  'billing.bills.generate': 'Bills generated',
  'notice.publish': 'Notice published',
  'members.approve': 'Registration approved',
  'members.reject': 'Registration rejected',
  'members.deactivate': 'Member deactivated',
  'members.changeRoles': 'Member roles changed',
  'building_layout.save': 'Building layout saved',
  'society_profile.update': 'Society profile updated',
  'society.update_gate_settings': 'Gate settings updated',
  'society.update_language_availability': 'Language settings updated',
  'settings.update': 'Module settings updated',
  'amc.settings.update': 'AMC settings updated',
  'billing.settings.update': 'Billing settings updated',
  'delivery.settings.update': 'Delivery settings updated',
  'expense.settings.update': 'Expense settings updated',
  'sos.settings.update': 'SOS settings updated',
  'staff.settings.update': 'Staff settings updated',
  'tenancy.settings.update': 'Tenancy settings updated',
  'visitor.settings.update': 'Visitor settings updated',
} as const satisfies Record<string, string>;

export function adminActionLabel(action: string): string {
  return Object.hasOwn(ADMIN_ACTION_LABELS, action)
    ? ADMIN_ACTION_LABELS[action as keyof typeof ADMIN_ACTION_LABELS]
    : 'Society change recorded';
}

export const ADMIN_ACTIVITY_LABELS = {
  request_opened: 'Request raised',
  request_resolved: 'Request resolved',
  notice_published: 'Notice published',
  meeting_scheduled: 'Meeting scheduled',
  meeting_held: 'Meeting held',
  registration: 'New registration',
} as const satisfies Record<AdminActivityItem['kind'], string>;

export function adminActivityLink(item: AdminActivityItem): string {
  switch (item.kind) {
    case 'request_opened':
    case 'request_resolved':
      return `/requests/${item.id}`;
    case 'notice_published':
      return `/admin/notices/${item.id}`;
    case 'meeting_scheduled':
    case 'meeting_held':
      return `/admin/meetings/${item.id}`;
    case 'registration':
      return '/admin/members';
  }
}
