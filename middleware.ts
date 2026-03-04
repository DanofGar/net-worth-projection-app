import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Public routes that don't require authentication
  const isLoginPage = req.nextUrl.pathname === '/login';
  const isLandingPage = req.nextUrl.pathname === '/landing';
  const isApiRoute = req.nextUrl.pathname.startsWith('/api');
  const isPublicAsset = req.nextUrl.pathname.startsWith('/_next') ||
                        req.nextUrl.pathname.startsWith('/favicon');
  const isResetPassword = req.nextUrl.pathname === '/reset-password';
  const isUpdatePassword = req.nextUrl.pathname === '/update-password';
  const isPublicRoute = isLoginPage || isLandingPage || isApiRoute || isPublicAsset || isResetPassword || isUpdatePassword;

  // Redirect unauthenticated users to login (except public routes).
  // Pass ?expired=1 when the request had auth cookies but no valid user,
  // which indicates an expired or invalidated session.
  if (!user && !isPublicRoute) {
    const hadAuthCookies = req.cookies.getAll().some((c) =>
      c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );
    const loginUrl = new URL('/login', req.url);
    if (hadAuthCookies) {
      loginUrl.searchParams.set('expired', '1');
    }
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login to dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
