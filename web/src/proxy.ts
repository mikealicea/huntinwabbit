import type { NextRequest } from 'next/server';
import { refreshAuth } from '@/features/auth/auth.server.index';

export async function proxy(request: NextRequest) {
  return refreshAuth(request);
}

export const config = {
  matcher: [
    '/app/:path*',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth/confirm',
  ],
};
