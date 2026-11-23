// Allow Vercel Web Analytics only on approved public Homeish routes.
const PUBLIC_ANALYTICS_PATHS = new Set(['/', '/privacy']);

export function isPublicAnalyticsPath(pathname: string): boolean {
  return PUBLIC_ANALYTICS_PATHS.has(pathname);
}

export function sanitizeWebAnalyticsEvent<T extends { url: string }>(
  event: T,
): T | null {
  try {
    const parsed = new URL(event.url, 'https://homeish.invalid');
    if (!isPublicAnalyticsPath(parsed.pathname)) return null;
    const relative = parsed.origin === 'https://homeish.invalid';
    return {
      ...event,
      url: relative ? parsed.pathname : `${parsed.origin}${parsed.pathname}`,
    };
  } catch {
    return null;
  }
}
