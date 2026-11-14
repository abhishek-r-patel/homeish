// Restrict post-auth navigation to local application routes.
const RETURNABLE_ROUTE_PREFIXES = [
  '/session',
  '/resident',
  '/guard',
  '/admin',
  '/housekeeping',
  '/developer',
];

export function safeReturnPath(candidate: unknown): string | null {
  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\')
  ) {
    return null;
  }

  const parsed = new URL(candidate, 'https://homeish.invalid');
  if (parsed.origin !== 'https://homeish.invalid') {
    return null;
  }

  const isReturnable = RETURNABLE_ROUTE_PREFIXES.some(
    (prefix) =>
      parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
  );
  return isReturnable ? parsed.pathname : null;
}
