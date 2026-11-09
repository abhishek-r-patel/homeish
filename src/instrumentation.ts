// Validate the server environment before the Next.js server accepts requests.
import type { Instrumentation } from 'next';
import { createRequestId, REQUEST_ID_HEADER } from './core/errors/request-id';

export async function register(): Promise<void> {
  await import('./core/config/server-env');
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeSentry } = await import('./core/logging/sentry');
    initializeSentry();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
): Promise<void> => {
  const header = request.headers[REQUEST_ID_HEADER];
  const requestId = createRequestId(Array.isArray(header) ? header[0] : header);
  const route = request.path.split('?')[0] || context.routePath;
  const { logUnexpectedError } = await import('./core/logging/error-logger');
  await logUnexpectedError(error, {
    requestId,
    route,
    source: 'server',
    severity: 'error',
  });
};
