// Reject unconfigured hosts and keep non-public entry points out of search.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { parseRoutingEnvironment } from './core/config/env-schema';
import { resolveSiteSurface } from './core/config/host-routing';
import { supabaseAuthCookieOptions } from './core/db/auth-cookie-options';
import {
  buildContentSecurityPolicy,
  createNonce,
  NONCE_HEADER,
} from './core/security/headers';

export async function proxy(request: NextRequest) {
  const surface = resolveSiteSurface(
    request.headers.get('host'),
    parseRoutingEnvironment(process.env),
  );
  if (!surface || (surface === 'society' && request.nextUrl.pathname !== '/')) {
    return new NextResponse('This Homeish address is not configured.', {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDevelopment: process.env.NODE_ENV === 'development',
    isHttps: request.nextUrl.protocol === 'https:',
  });
  // Next.js reads the nonce from the request's CSP header while rendering.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set('Content-Security-Policy', contentSecurityPolicy);
    headers.set(NONCE_HEADER, nonce);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();
  const pathname = request.nextUrl.pathname;
  const shouldRefreshSession =
    pathname === '/session' ||
    pathname.startsWith('/session/') ||
    pathname.startsWith('/resident') ||
    pathname.startsWith('/guard') ||
    pathname.startsWith('/admin') ||
    (pathname.startsWith('/developer') && pathname !== '/developer/login');
  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some((cookie) => /-auth-token(?:\.\d+)?$/.test(cookie.name));

  if (shouldRefreshSession && hasSupabaseAuthCookie) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase public environment is not configured.');
    }
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: supabaseAuthCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = forward();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });
    const { error } = await supabase.auth.getUser();
    if (error && error.status !== 401) {
      throw new Error('Could not refresh the sign-in session.', {
        cause: error,
      });
    }
  }
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  response.headers.set('Cache-Control', 'private, no-store');
  if (surface !== 'website') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|homeish-logo\\.svg|favicon\\.ico).*)',
  ],
};
