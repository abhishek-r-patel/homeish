// Expose narrow privileged operations without exposing the service-role client.
export {
  writeAuditLog,
  writeErrorLog,
  type AuditLogWrite,
  type ErrorLogWrite,
} from './log-writers';
export { consumeRateLimitKey } from './rate-limit-writer';
export { checkDatabaseHealth } from './health-check';
