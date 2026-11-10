// Use the host-provided client IP headers consistently for rate limiting.
export function clientIpFromHeaders(headers: Headers): string {
  const vercelIp = headers.get('x-vercel-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const forwardedIp = headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const identifier =
    vercelIp?.trim() || realIp?.trim() || forwardedIp || 'unknown';
  return identifier.length <= 512 ? identifier : 'unknown';
}
