// Download an edited letter as an unsaved PDF and log the generation for admins and committee.
import { AppError } from '../../../core/errors';
import { runDownloadRoute } from '../../../core/files/download';
import { isSameOrigin, readFileRequestBody } from '../../../core/files/http';
import { downloadLetter } from '../../../core/letters/operations';

const MAX_LETTER_REQUEST_BYTES = 32_768;

export async function POST(request: Request) {
  return runDownloadRoute(request, '/api/letters', async (requestId) => {
    if (!isSameOrigin(request)) throw new AppError('FORBIDDEN');
    const body = await readFileRequestBody(request, MAX_LETTER_REQUEST_BYTES);
    return downloadLetter(body, requestId);
  });
}
