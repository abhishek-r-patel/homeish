// Map notification entities to the in-app page that shows them.
const ENTITY_PATHS: Readonly<Record<string, string>> = {
  billing_bill: '/bills',
  delivery_entry: '/deliveries',
  notice: '/notices',
  service_request: '/requests',
  visitor_entry: '/visitors',
  tenancy_move: '/tenancy',
  tenancy_admin: '/admin/tenancy',
  vendor_purchase_request: '/admin/vendors/requests',
  poll: '/polls',
  meeting: '/meetings',
  meeting_admin: '/admin/meetings',
  event: '/events',
  event_admin: '/admin/events',
  community_post: '/community/posts',
  community_listing: '/community/marketplace',
};

const FIXED_PATHS: Readonly<Record<string, string>> = {
  amenity_booking: '/amenities',
  amc: '/admin/amc',
  expense: '/admin/expenses',
  housekeeping: '/housekeeping',
  billing_payment: '/bills?tab=payments',
  billing_payment_details: '/admin/billing?tab=payment-settings',
  billing_payment_review: '/admin/billing?tab=payments',
  tenancy_schedule: '/guard/tenancy',
  parking: '/parking',
  parking_admin: '/admin/parking',
  parking_guard: '/guard/parking',
  patrol_admin: '/admin/patrol',
  patrol_guard: '/guard/patrol',
  metering: '/metering',
  metering_admin: '/admin/metering',
  metering_guard: '/guard/metering',
  sos_alert: '/sos',
  sos_admin: '/admin/sos',
  sos_guard: '/guard/sos',
  document: '/documents',
  document_admin: '/admin/documents',
  home_services_admin: '/admin/home-services',
  meeting_action: '/meetings/actions',
  meeting_action_admin: '/admin/meetings/actions',
  community_admin: '/admin/community',
};

export function notificationPath(
  entityType: string | null,
  entityId: string | null,
  isEntityId: (value: string) => boolean,
): string | null {
  if (entityType && FIXED_PATHS[entityType]) return FIXED_PATHS[entityType];
  if (!entityId || !isEntityId(entityId)) return null;
  const path = entityType ? ENTITY_PATHS[entityType] : undefined;
  return path ? `${path}/${encodeURIComponent(entityId)}` : null;
}
