// Canonical module keys shared by the registry and authorization layer.
export const MODULE_KEYS = [
  'core',
  'visitor',
  'delivery',
  'billing',
  'service_request',
  'staff',
  'housekeeping',
  'amc',
  'notice',
  'amenity',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
