// Persist unexpected errors best-effort and return a safe user reference ID.
import { serverEnvironment } from '../config/server-env';
import type { Json } from '../db/database.types';
import { writeErrorLog } from '../privileged';
import { createReferenceId } from './reference-id';
import { scrubLogData, scrubLogText } from './scrub';
import { captureSentryException } from './sentry';

function scrubDevice(device: unknown): Json | null {
  const scrubbed = scrubLogData(device);
  if (
    typeof scrubbed !== 'object' ||
    scrubbed === null ||
    Array.isArray(scrubbed)
  ) {
    return null;
  }
  return scrubbed;
}

export interface UnexpectedErrorContext {
  requestId: string;
  route: string;
  source: 'server' | 'client' | 'job';
  severity?: 'critical' | 'error' | 'warning' | 'info';
  societyId?: string;
  userId?: string;
  role?: string;
  moduleKey?: string;
  device?: unknown;
}

export async function logUnexpectedError(
  error: unknown,
  context: UnexpectedErrorContext,
): Promise<string> {
  const referenceId = createReferenceId();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred.';
  const stack = error instanceof Error ? error.stack : undefined;
  const route = scrubLogText(context.route.split('?')[0] ?? '');
  const severity = context.severity ?? 'error';
  const safeContext = {
    referenceId,
    requestId: scrubLogText(context.requestId),
    source: context.source,
    severity,
    route,
    message: scrubLogText(message),
    stack: stack ? scrubLogText(stack) : null,
  };

  try {
    await writeErrorLog({
      reference_id: referenceId,
      request_id: safeContext.requestId,
      source: context.source,
      severity,
      message: safeContext.message,
      stack: safeContext.stack,
      app_version: serverEnvironment.server.APP_VERSION,
      society_id: context.societyId ?? null,
      user_id: context.userId ?? null,
      role: context.role ?? null,
      module_key: context.moduleKey ?? null,
      route,
      device: context.device === undefined ? null : scrubDevice(context.device),
    });
  } catch {
    console.error('Homeish error-log write failed.', safeContext);
  }

  try {
    captureSentryException(error, {
      requestId: context.requestId,
      route,
      source: context.source,
    });
  } catch {
    console.error('Homeish Sentry reporting failed.', {
      requestId: context.requestId,
    });
  }

  return referenceId;
}
