// Closed API error codes and conflict reasons shared by services and routes.
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'MFA_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'MODULE_DISABLED',
  'SOCIETY_SUSPENDED',
  'SOCIETY_ARCHIVED',
  'CONFLICT',
  'RATE_LIMITED',
  'GUARD_NOT_IDENTIFIED',
  'INTEGRATION_FAILED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const CONFLICT_REASONS = [
  'already_decided',
  'expired',
  'duplicate_reference',
  'duplicate_charge',
  'stale_version',
  'invalid_state',
  'limit_reached',
  'has_history',
  'not_unpaid',
] as const;

export type ConflictReason = (typeof CONFLICT_REASONS)[number];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Check the highlighted fields.',
  UNAUTHENTICATED: 'Sign in to continue.',
  SESSION_EXPIRED: 'Your session has ended. Sign in again to continue.',
  MFA_REQUIRED: 'Verify your identity to continue.',
  FORBIDDEN: "You don't have access to do that.",
  NOT_FOUND: 'This item could not be found.',
  MODULE_DISABLED: 'This feature is not enabled for your society.',
  SOCIETY_SUSPENDED: 'This society is currently read-only.',
  SOCIETY_ARCHIVED: 'This society is no longer available.',
  CONFLICT: 'This action can no longer be completed. Refresh and try again.',
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
  GUARD_NOT_IDENTIFIED: 'Select the guard handling this entry to continue.',
  INTEGRATION_FAILED: 'A connected service is temporarily unavailable.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  MFA_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  MODULE_DISABLED: 403,
  SOCIETY_SUSPENDED: 403,
  SOCIETY_ARCHIVED: 403,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  GUARD_NOT_IDENTIFIED: 403,
  INTEGRATION_FAILED: 503,
  INTERNAL_ERROR: 500,
};
