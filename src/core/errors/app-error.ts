// Typed application failures with only user-safe details in the response.
import { ERROR_MESSAGES, type ConflictReason, type ErrorCode } from './codes';

export interface AppErrorOptions {
  message?: string;
  fieldErrors?: Record<string, string>;
  reason?: ConflictReason;
  referenceId?: string;
  retryAfterSeconds?: number;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly reason?: ConflictReason;
  readonly referenceId?: string;
  readonly retryAfterSeconds?: number;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.reason = options.reason;
    this.referenceId = options.referenceId;
    this.retryAfterSeconds = options.retryAfterSeconds;

    if (code === 'CONFLICT' && !options.reason) {
      throw new TypeError('CONFLICT errors require a closed-list reason.');
    }
    if (code !== 'CONFLICT' && options.reason !== undefined) {
      throw new TypeError('Only CONFLICT errors may include a reason.');
    }
    if (code !== 'VALIDATION_FAILED' && options.fieldErrors !== undefined) {
      throw new TypeError('Only validation errors may include field errors.');
    }
    if (code === 'RATE_LIMITED') {
      if (
        options.retryAfterSeconds !== undefined &&
        (!Number.isInteger(options.retryAfterSeconds) ||
          options.retryAfterSeconds < 1)
      ) {
        throw new TypeError('Retry time must be a positive integer.');
      }
    } else if (options.retryAfterSeconds !== undefined) {
      throw new TypeError('Only rate-limit errors may include a retry time.');
    }
  }
}

export class ValidationError extends AppError {
  constructor(fieldErrors: Record<string, string>, message?: string) {
    super('VALIDATION_FAILED', { fieldErrors, message });
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(reason: ConflictReason, message?: string) {
    super('CONFLICT', { reason, message });
    this.name = 'ConflictError';
  }
}
