import { NextResponse, type NextRequest } from 'next/server';

/** Session cookie name issued by the API (must match SESSION_COOKIE_NAME). */
const SESSION_COOKIE_NAME = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? 'cs_session';

/**
 * Route protection for the authenticated surface (Req 3, Design §8).
 *
 * Performs a fast presence check on the session cookie and redirects
 * unauthenticated visitors to `/signin` (preserving where they were headed).
 * Full session validation still happens server-side on every API call; this is
 * only the first gate so protected pages never flash for signed-out users.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSession) {
    return NextResponse.next();
  }

  const signinUrl = new URL('/signin', request.url);
  const target = request.nextUrl.pathname + request.nextUrl.search;
  signinUrl.searchParams.set('returnTo', target);
  return NextResponse.redirect(signinUrl);
}

export const config = {
  // Protect the app shell and the admin surface.
  matcher: ['/app/:path*', '/admin/:path*'],
};
