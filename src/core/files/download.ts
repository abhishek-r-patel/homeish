// Serve authorized, non-cacheable file downloads with the standard error envelope.
import 'server-only';
import {
  AppError,
  createRequestId,
  errorHttpStatus,
  failureEnvelope,
  REQUEST_ID_HEADER,
} from '../errors';
import { logUnexpectedError } from '../logging/error-logger';

export type DownloadFile = {
  body: Uint8Array | string;
  contentType: string;
  fileName: string;
};

export async function runDownloadRoute(
  request: Request,
  route: string,
  handler: (requestId: string) => Promise<DownloadFile>,
): Promise<Response> {
  const requestId = createRequestId(request.headers.get(REQUEST_ID_HEADER));
  try {
    const file = await handler(requestId);
    const fileName = file.fileName.replace(/[^A-Za-z0-9._-]/g, '-');
    return new Response(
      typeof file.body === 'string'
        ? file.body
        : new Blob([file.body as Uint8Array<ArrayBuffer>]),
      {
        headers: {
          [REQUEST_ID_HEADER]: requestId,
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Type': file.contentType,
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError('INTERNAL_ERROR', {
            referenceId: await logUnexpectedError(error, {
              requestId,
              route,
              source: 'server',
            }),
          });
    return Response.json(failureEnvelope(appError), {
      status: errorHttpStatus(appError.code),
      headers: { [REQUEST_ID_HEADER]: requestId, 'Cache-Control': 'no-store' },
    });
  }
}
