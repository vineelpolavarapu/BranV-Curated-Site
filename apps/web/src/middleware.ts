import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'branv_access';

/**
 * Cookie-presence redirect middleware.
 *
 * We can't decode the JWT here without leaking the secret to the edge runtime,
 * so this only checks whether an access cookie exists. Role-based gating
 * (member vs admin) happens on the protected page itself via /api/auth/me -
 * the backend is the source of truth and will 401/403 anyway.
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hasAccess = !!req.cookies.get(ACCESS_COOKIE);

  const isAccount = url.pathname.startsWith('/account');
  const isAdmin =
    url.pathname.startsWith('/admin') &&
    !url.pathname.startsWith('/admin/login');
  const isMemberAuth =
    url.pathname === '/login' || url.pathname === '/register';

  if ((isAccount || isAdmin) && !hasAccess) {
    const loginPath = isAdmin ? '/admin/login' : '/login';
    const redirect = url.clone();
    redirect.pathname = loginPath;
    redirect.searchParams.set('next', url.pathname);
    return NextResponse.redirect(redirect);
  }

  if (isMemberAuth && hasAccess) {
    const redirect = url.clone();
    redirect.pathname = '/account';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/account/:path*', '/admin/:path*', '/login', '/register'],
};
