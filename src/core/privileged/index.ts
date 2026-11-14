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
export {
  isRegistrationCodeActive,
  lookupRegistrationSociety,
} from './registration';
export { lookupSocietyHost, type SocietyHostRecord } from './society-hosts';
export { checkDailyJobHealth, checkDatabaseHealth } from './health-check';
export {
  claimDailyJobRun,
  completeDailyJobRun,
  listDailyJobSocieties,
} from './daily-jobs';
export { sendTransactionalEmail } from './transactional-email';
export {
  checkInPreApprovedVisitorPrivileged,
  checkInVisitorPrivileged,
  checkOutVisitorPrivileged,
  createVisitorEntryPrivileged,
  overrideVisitorPrivileged,
  runVisitorExpirationPrivileged,
  validateVisitorCodePrivileged,
} from './visitor';
export {
  collectDeliveryAsGuardPrivileged,
  createDeliveryEntryPrivileged,
  overrideDeliveryPrivileged,
} from './delivery';
export {
  runBillingDailyTaskPrivileged,
  sendBillingReceiptEmailPrivileged,
  type BillingDailyTask,
  type BillingReceiptEmail,
} from './billing';
export { runRetentionPrivileged } from './retention';
export { runUserErasurePrivileged } from './user-erasure';
export { runServiceRequestAutoClosePrivileged } from './service-requests';
export { runInventoryRemindersPrivileged } from './housekeeping';
export type { TransactionalEmail } from '../notifications/email';
export { runAmcRemindersPrivileged } from './amc';
