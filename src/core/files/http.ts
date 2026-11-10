// Apply same-origin, bounded JSON, and standard response rules to file routes.
import 'server-only';
import {
  AppError,
  createRequestId,
  errorHttpStatus,
  failureEnvelope,
  REQUEST_ID_HEADER,
  successEnvelope,
  ValidationError,
} from '../errors';
import { logUnexpectedError } from '../logging/error-logger';
import { buildRequestContext } from '../tenancy/request-context';
import type { RequestContext } from '../tenancy/request-context';

export async function readFileRequestBody(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
    'application/json'
  ) {
    throw new ValidationError({ body: 'Send a JSON request body.' });
  }
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const size = Number(declaredLength);
    if (!Number.isSafeInteger(size) || size < 0 || size > 8_192) {
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

export function isSameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export async function runFileRoute<T>(
  request: Request,
  route: string,
  handler: (
    context: RequestContext,
    body: unknown,
    requestId: string,
  ) => Promise<T>,
): Promise<Response> {
  const requestId = createRequestId(request.headers.get(REQUEST_ID_HEADER));
  try {
    if (!isSameOrigin(request)) throw new AppError('FORBIDDEN');
    const body = await readFileRequestBody(request);
    const context = await buildRequestContext(requestId);
    const data = await handler(context, body, requestId);
    return Response.json(successEnvelope(data), {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError(
            'INTERNAL_ERROR',
            error instanceof Error
              ? {
                  referenceId: await logUnexpectedError(
                    new Error('File storage operation failed.'),
                    { requestId, route, source: 'server' },
                  ),
                }
              : {},
          );
    return Response.json(failureEnvelope(appError), {
      status: errorHttpStatus(appError.code),
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        'Cache-Control': 'no-store',
      },
    });
  }
}
