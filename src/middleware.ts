import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow access to login page
  if (request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // Block sandbox in production
  if (request.nextUrl.pathname.startsWith('/dashboard/test') && process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Protect the dashboard and root paths
  if (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname === '/') {
    const authCookie = request.cookies.get('auth_status');
    
    // If no generic auth cookie is present, redirect to login
    // Note: This relies on the client SDK setting this cookie during login
    if (!authCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/login'],
};
