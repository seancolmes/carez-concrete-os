import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_MIDDLEWARE_BUDGET_MS = 2000;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        items: Array<{
          name: string;
          value: string;
          options?: Parameters<typeof response.cookies.set>[2];
        }>,
      ) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() always performs a remote Auth request. In routing middleware that
  // made every navigation depend on Supabase responding before Vercel's 25s
  // middleware deadline. getClaims() is the recommended SSR verification path;
  // with asymmetric signing keys it verifies against cached JWKS instead.
  //
  // Keep an explicit routing budget as a second line of defense. If auth/JWKS is
  // temporarily unavailable, protected Server Components and actions still
  // enforce authorization; routing itself must continue responding.
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, AUTH_MIDDLEWARE_BUDGET_MS);
    supabase.auth.getClaims().then(finish, finish);
  });

  return response;
}
