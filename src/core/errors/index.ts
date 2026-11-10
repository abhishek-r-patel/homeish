// Public exports for the shared error model.
export { AppError, ConflictError, ValidationError } from './app-error';
export {
  CONFLICT_REASONS,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  ERROR_MESSAGES,
  type ConflictReason,
  type ErrorCode,
} from './codes';
export {
  errorHttpStatus,
  failureEnvelope,
  successEnvelope,
  type FailureEnvelope,
  type SuccessEnvelope,
} from './envelope';
export {
  createRequestId,
  requestIdFromHeaders,
  REQUEST_ID_HEADER,
} from './request-id';
