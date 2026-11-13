// Map notification entities to the in-app page that shows them.
const ENTITY_PATHS: Readonly<Record<string, string>> = {
  billing_bill: '/bills',
  delivery_entry: '/deliveries',
  notice: '/notices',
  service_request: '/requests',
  visitor_entry: '/visitors',
};

const FIXED_PATHS: Readonly<Record<string, string>> = {
  billing_payment: '/bills?tab=payments',
  billing_payment_details: '/admin/billing?tab=payment-settings',
  billing_payment_review: '/admin/billing?tab=payments',
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
