// Normalize expected and unexpected failures returned by server actions.
import { headers } from 'next/headers';
import {
  AppError,
  ERROR_MESSAGES,
  createRequestId,
  requestIdFromHeaders,
  type ErrorCode,
} from '../errors';
import { logUnexpectedError } from '../logging/error-logger';

export type ServerActionResult<TData = never> =
  | { ok: true; message?: string; data?: TData }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
      referenceId?: string;
      fieldErrors?: Readonly<Record<string, string>>;
      retryAfterSeconds?: number;
    };

export async function runServerAction<TData = never>(
  route: string,
  operation: (
    requestId: string,
  ) => Promise<string | void | { message?: string; data: TData }>,
): Promise<ServerActionResult<TData>> {
  let requestId = createRequestId();
  try {
    requestId = requestIdFromHeaders(await headers());
    const result = await operation(requestId);
    if (typeof result === 'string') return { ok: true, message: result };
    return result ? { ok: true, ...result } : { ok: true };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        ...(error.referenceId ? { referenceId: error.referenceId } : {}),
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        ...(error.retryAfterSeconds
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      };
    }

    const referenceId = await logUnexpectedError(error, {
      requestId,
      route,
      source: 'server',
    });
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      referenceId,
    };
  }
}
