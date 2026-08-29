import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_MIDDLEWARE_BUDGET_MS = 2000;

export async function updateSession(request: NextRequest) {
  const startedAt = Date.now();
  console.info('[carez-mw] start', request.nextUrl.pathname);

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.info('[carez-mw] env', Boolean(url), Boolean(key), Date.now() - startedAt);
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
  console.info('[carez-mw] client-created', Date.now() - startedAt);

  // Diagnostic timing markers are intentionally limited to phase names and
  // elapsed milliseconds. Do not log cookies, JWTs, users, or auth payloads.
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (source: 'claims' | 'timeout') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.info(`[carez-mw] auth-finish:${source}`, Date.now() - startedAt);
      resolve();
    };
    const timer = setTimeout(() => finish('timeout'), AUTH_MIDDLEWARE_BUDGET_MS);
    console.info('[carez-mw] claims-start', Date.now() - startedAt);
    supabase.auth.getClaims().then(
      () => finish('claims'),
      () => finish('claims'),
    );
  });

  console.info('[carez-mw] return', Date.now() - startedAt);
  return response;
}
