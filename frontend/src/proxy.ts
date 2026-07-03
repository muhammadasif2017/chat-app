import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? '';
  const wsScheme = wsUrl.replace(/^http/, 'ws');
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? ''} ${wsUrl} ${wsScheme}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const isAuthed = req.cookies.has('ca_authed');

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  if (!isAuthed && !isPublic) {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }
  if (isAuthed && isPublic) {
    const res = NextResponse.redirect(new URL('/', req.url));
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};
