// Create or validate a request ID for client-to-server trace correlation.
export const REQUEST_ID_HEADER = 'x-request-id';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createRequestId(candidate?: string | null): string {
  return candidate && UUID_PATTERN.test(candidate)
    ? candidate.toLowerCase()
    : crypto.randomUUID();
}

export function requestIdFromHeaders(headers: Headers): string {
  return createRequestId(headers.get(REQUEST_ID_HEADER));
}
