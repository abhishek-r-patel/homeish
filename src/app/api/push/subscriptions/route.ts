// Register or remove only the signed-in user's validated Web Push endpoint.
import { z } from 'zod';
import {
  AppError,
  createRequestId,
  errorHttpStatus,
  failureEnvelope,
  REQUEST_ID_HEADER,
  successEnvelope,
  ValidationError,
} from '../../../../core/errors';
import { logUnexpectedError } from '../../../../core/logging/error-logger';
import { isAllowedPushEndpoint } from '../../../../core/notifications/push';
import { enforceRateLimit } from '../../../../core/rate-limit';
import { buildRequestContext } from '../../../../core/tenancy/request-context';

const subscriptionSchema = z
  .object({
    endpoint: z.string().url().max(2048).refine(isAllowedPushEndpoint),
    keys: z
      .object({
        auth: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/),
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
      })
      .strict(),
  })
  .strict();
const endpointSchema = z
  .object({
    endpoint: z.string().url().max(2048).refine(isAllowedPushEndpoint),
  })
  .strict();

function isSameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

function respondError(error: AppError, requestId: string) {
  return Response.json(failureEnvelope(error), {
    status: errorHttpStatus(error.code),
    headers: {
      [REQUEST_ID_HEADER]: requestId,
      'Cache-Control': 'no-store',
    },
  });
}

async function readJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      throw new ValidationError({ body: 'The request body is invalid.' });
    }
    if (declaredLength > 8_192) {
      throw new ValidationError({ body: 'The request body is too large.' });
    }
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ValidationError({ body: 'A JSON body is required.' });
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > 8_192) {
      await reader.cancel();
      throw new ValidationError({ body: 'The request body is too large.' });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ValidationError({ body: 'The request body is not valid UTF-8.' });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError({ body: 'Send a valid JSON request body.' });
  }
}

async function run(
  request: Request,
  method: 'register' | 'delete',
): Promise<Response> {
  const requestId = createRequestId(request.headers.get(REQUEST_ID_HEADER));
  try {
    if (!isSameOrigin(request)) throw new AppError('FORBIDDEN');
    if (
      request.headers
        .get('content-type')
        ?.split(';')[0]
        ?.trim()
        .toLowerCase() !== 'application/json'
    ) {
      throw new ValidationError({ body: 'Send a JSON request body.' });
    }

    const body = await readJson(request);
    let subscription: z.infer<typeof subscriptionSchema> | null = null;
    let endpoint: string;
    if (method === 'register') {
      const payload = subscriptionSchema.safeParse(body);
      if (!payload.success) {
        throw new ValidationError({
          body: 'The push subscription is invalid.',
        });
      }
      subscription = payload.data;
      endpoint = payload.data.endpoint;
    } else {
      const payload = endpointSchema.safeParse(body);
      if (!payload.success) {
        throw new ValidationError({
          body: 'The push subscription is invalid.',
        });
      }
      endpoint = payload.data.endpoint;
    }

    const context = await buildRequestContext(requestId);
    await enforceRateLimit(
      'pushSubscriptionsUserHourly',
      context.userId,
      requestId,
    );
    const database = context.db;
    const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null;
    const { error } = subscription
      ? await database.rpc('register_push_subscription', {
          p_endpoint: subscription.endpoint,
          p_p256dh: subscription.keys.p256dh,
          p_auth_secret: subscription.keys.auth,
          ...(userAgent === null ? {} : { p_user_agent: userAgent }),
        })
      : await database.rpc('delete_push_subscription', {
          p_endpoint: endpoint,
        });
    if (error) {
      if (error.code === '42501') throw new AppError('FORBIDDEN');
      throw new Error('Push subscription storage failed.');
    }

    return Response.json(successEnvelope({}), {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AppError) return respondError(error, requestId);
    const referenceId = await logUnexpectedError(
      new Error('Push subscription storage failed.'),
      {
        requestId,
        route: '/api/push/subscriptions',
        source: 'server',
      },
    );
    return respondError(
      new AppError('INTERNAL_ERROR', { referenceId }),
      requestId,
    );
  }
}

export async function POST(request: Request) {
  return run(request, 'register');
}

export async function DELETE(request: Request) {
  return run(request, 'delete');
}
