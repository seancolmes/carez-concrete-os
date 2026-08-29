import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
  try {
    await supabase.auth.getClaims();
  } catch {
    // Authorization is enforced again by protected Server Components/actions.
    // Routing middleware must never make the entire application unavailable
    // because the auth service is temporarily slow or unreachable.
  }

  return response;
}
