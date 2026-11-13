// Build the per-request Content Security Policy and the static security headers (ARCHITECTURE security table).

export const NONCE_HEADER = 'x-nonce';

export interface ContentSecurityPolicyOptions {
  nonce: string;
  supabaseUrl?: string;
  isDevelopment: boolean;
  isHttps: boolean;
}

function supabaseOrigins(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return { http: [], socket: [] };
  try {
    const url = new URL(supabaseUrl);
    const socketProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return { http: [url.origin], socket: [`${socketProtocol}//${url.host}`] };
  } catch {
    return { http: [], socket: [] };
  }
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildContentSecurityPolicy({
  nonce,
  supabaseUrl,
  isDevelopment,
  isHttps,
}: ContentSecurityPolicyOptions): string {
  const supabase = supabaseOrigins(supabaseUrl);
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        ...(isDevelopment ? ["'unsafe-eval'"] : []),
      ],
    ],
    // React renders server-side style attributes, which nonces cannot cover.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'blob:', 'data:', ...supabase.http]],
    ['font-src', ["'self'"]],
    [
      'connect-src',
      [
        "'self'",
        ...supabase.http,
        ...supabase.socket,
        ...(isDevelopment ? ['ws:'] : []),
      ],
    ],
    ['media-src', ["'self'", 'blob:']],
    ['worker-src', ["'self'"]],
    ['manifest-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['frame-src', ["'none'"]],
  ];
  const policy = directives.map(
    ([name, sources]) => `${name} ${sources.join(' ')}`,
  );
  if (isHttps) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

export const STATIC_SECURITY_HEADERS: ReadonlyArray<{
  key: string;
  value: string;
}> = [
  // Browsers ignore HSTS on plain-HTTP responses, so local HTTP is unaffected.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
];
