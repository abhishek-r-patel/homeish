// Expose narrow privileged operations without exposing the service-role client.
export { ensureAuthUserForSignIn, hasSignInAccess } from './auth-invitations';
export {
  finishAuthCodeAttempt,
  reserveAuthCodeAttempt,
  startAuthCodeChallenge,
  type AuthCodeAttemptReservation,
  type AuthCodeAttemptStatus,
} from './auth-code-challenges';
export {
  writeAuditLog,
  writeErrorLog,
  type AuditLogWrite,
  type ErrorLogWrite,
} from './log-writers';
export { consumeRateLimitKey } from './rate-limit-writer';
export { checkDatabaseHealth } from './health-check';
