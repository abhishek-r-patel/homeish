// Reject unconfigured hosts and keep non-public entry points out of search.
import { NextResponse, type NextRequest } from 'next/server';
import { parseRoutingEnvironment } from './core/config/env-schema';
import { resolveSiteSurface } from './core/config/host-routing';

export function proxy(request: NextRequest) {
  const surface = resolveSiteSurface(
    request.headers.get('host'),
    parseRoutingEnvironment(process.env),
  );
  if (!surface) {
    return new NextResponse('This Dwello address is not configured.', {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  if (surface !== 'website') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|dwello-logo\\.svg|favicon\\.ico).*)',
  ],
};
