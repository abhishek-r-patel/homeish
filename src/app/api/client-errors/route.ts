// Accept bounded, scrubbed client errors and return their safe reference IDs.
import { z } from 'zod';
import {
  AppError,
  createRequestId,
  errorHttpStatus,
  failureEnvelope,
  REQUEST_ID_HEADER,
  successEnvelope,
  ValidationError,
} from '../../../core/errors';
import { logUnexpectedError } from '../../../core/logging/error-logger';
import { enforceRateLimit } from '../../../core/rate-limit';
import { clientIpFromHeaders } from '../../../core/request/client-ip';

const MAX_BODY_BYTES = 8 * 1024;

const clientErrorSchema = z
  .object({
    message: z.string().trim().min(1).max(2_000),
    stack: z.string().max(6_000).optional(),
    route: z.string().trim().startsWith('/').max(500),
    device: z
      .object({
        userAgent: z.string().max(500).optional(),
        platform: z.string().max(120).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      throw new ValidationError({ body: 'The request body is invalid.' });
    }
    if (declaredLength > MAX_BODY_BYTES) {
      throw new ValidationError({ body: 'The request body is too large.' });
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new ValidationError({ body: 'A JSON request body is required.' });
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ValidationError({ body: 'The request body is too large.' });
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ValidationError({
        body: 'The request body is not valid UTF-8.',
      });
    }
    throw error;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ValidationError({
        body: 'The request body is not valid JSON.',
      });
    }
    throw error;
  }
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}

function failureResponse(error: AppError, requestId: string): Response {
  const headers: Record<string, string> = {
    [REQUEST_ID_HEADER]: requestId,
    'Cache-Control': 'no-store',
  };
  if (error.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(error.retryAfterSeconds);
  }
  return Response.json(failureEnvelope(error), {
    status: errorHttpStatus(error.code),
    headers,
  });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId(request.headers.get(REQUEST_ID_HEADER));
  try {
    if (!isSameOrigin(request)) {
      throw new AppError('FORBIDDEN');
    }
    if (
      request.headers
        .get('content-type')
        ?.split(';')[0]
        ?.trim()
        .toLowerCase() !== 'application/json'
    ) {
      throw new ValidationError({ body: 'Send a JSON request body.' });
    }

    await enforceRateLimit(
      'clientErrorsMinute',
      clientIpFromHeaders(request.headers),
      requestId,
    );

    const payload = clientErrorSchema.safeParse(await readBoundedJson(request));
    if (!payload.success) {
      throw new ValidationError({
        body: 'The client error report is invalid.',
      });
    }

    const clientError = new Error(payload.data.message);
    if (payload.data.stack) {
      clientError.stack = payload.data.stack;
    }
    const referenceId = await logUnexpectedError(clientError, {
      requestId,
      route: payload.data.route.split('?')[0] ?? '',
      source: 'client',
      device: payload.data.device,
    });
    return Response.json(successEnvelope({ referenceId }), {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(error, requestId);
    }
    const referenceId = await logUnexpectedError(error, {
      requestId,
      route: '/api/client-errors',
      source: 'server',
    });
    return failureResponse(
      new AppError('INTERNAL_ERROR', { referenceId }),
      requestId,
    );
  }
}
