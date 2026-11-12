// Authenticate the platform scheduler and run isolated, idempotent daily jobs.
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  AppError,
  createRequestId,
  errorHttpStatus,
  failureEnvelope,
  REQUEST_ID_HEADER,
  successEnvelope,
} from '../../../../core/errors';
import { serverEnvironment } from '../../../../core/config/server-env';
import { logUnexpectedError } from '../../../../core/logging/error-logger';
import { runDailyJobs } from '../../../../core/jobs/daily';

function isAuthorized(request: Request): boolean {
  const secret = serverEnvironment.server.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  if (!secret || !match) return false;

  const suppliedDigest = createHash('sha256').update(match[1]).digest();
  const expectedDigest = createHash('sha256').update(secret).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

async function handleDailyJobRequest(request: Request): Promise<Response> {
  const requestId = createRequestId(request.headers.get(REQUEST_ID_HEADER));
  const headers = {
    'Cache-Control': 'no-store',
    [REQUEST_ID_HEADER]: requestId,
  };

  if (!isAuthorized(request)) {
    await logUnexpectedError(new Error('Unauthorized daily job request.'), {
      requestId,
      route: '/api/jobs/daily',
      source: 'job',
      severity: 'warning',
    }).catch(() => {
      console.error(
        'Homeish unauthorized daily job request could not be logged.',
      );
    });
    const error = new AppError('UNAUTHENTICATED');
    return Response.json(failureEnvelope(error), {
      status: errorHttpStatus(error.code),
      headers,
    });
  }

  try {
    const jobs = await runDailyJobs({ requestId });
    return Response.json(successEnvelope({ jobs }), { headers });
  } catch (error) {
    const referenceId = await logUnexpectedError(error, {
      requestId,
      route: '/api/jobs/daily',
      source: 'job',
    });
    const internalError = new AppError('INTERNAL_ERROR', { referenceId });
    return Response.json(failureEnvelope(internalError), {
      status: errorHttpStatus(internalError.code),
      headers,
    });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleDailyJobRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleDailyJobRequest(request);
}
