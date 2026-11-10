// Shared success and failure response envelopes for operations and JSON routes.
import { ERROR_HTTP_STATUS, type ErrorCode } from './codes';
import { AppError } from './app-error';

export interface SuccessEnvelope<T, M extends object = Record<string, never>> {
  ok: true;
  data: T;
  meta?: M;
}

export interface FailureEnvelope {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    fieldErrors?: Readonly<Record<string, string>>;
    reason?: string;
    referenceId?: string;
    retryAfterSeconds?: number;
  };
}

export function successEnvelope<T, M extends object = Record<string, never>>(
  data: T,
  meta?: M,
): SuccessEnvelope<T, M> {
  return meta === undefined ? { ok: true, data } : { ok: true, data, meta };
}

export function failureEnvelope(error: AppError): FailureEnvelope {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      ...(error.reason ? { reason: error.reason } : {}),
      ...(error.referenceId ? { referenceId: error.referenceId } : {}),
      ...(error.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    },
  };
}

export function errorHttpStatus(code: ErrorCode): number {
  return ERROR_HTTP_STATUS[code];
}
