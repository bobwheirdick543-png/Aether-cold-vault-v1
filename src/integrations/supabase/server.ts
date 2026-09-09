import { createServerClient } from '@supabase/ssr';
import { getCookies, setCookie, setResponseHeader } from '@tanstack/react-start/server';
import type { Database } from './types';

export function createSupabaseServerClient() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];

  if (!url || !key) {
    throw new Error('Missing Supabase server configuration.');
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookies, headers) {
        cookies.forEach(({ name, value, options }) => setCookie(name, value, options));
        Object.entries(headers).forEach(([name, value]) => setResponseHeader(name, value));
      },
    },
  });
}
