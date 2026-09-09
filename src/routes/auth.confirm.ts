import { createFileRoute } from '@tanstack/react-router';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/integrations/supabase/server';
import { bootstrapPlatformOwnerForUser } from '@/lib/server/platform-owner.server';

function safeNext(value: string | null, isAdmin: boolean) {
  if (isAdmin && value === '/admin') return '/admin';
  if (value === '/dashboard') return '/dashboard';
  return isAdmin ? '/admin' : '/dashboard';
}

export const Route = createFileRoute('/auth/confirm')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash');
        const type = url.searchParams.get('type') as EmailOtpType | null;
        const next = url.searchParams.get('next');
        const supabase = createSupabaseServerClient();

        let authError: Error | null = null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          authError = error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          authError = error;
        } else {
          authError = new Error('The confirmation link is incomplete or has expired.');
        }

        if (authError) {
          return Response.redirect(`${url.origin}/login?error=confirmation_failed`, 303);
        }

        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          return Response.redirect(`${url.origin}/login?error=confirmation_failed`, 303);
        }

        const bootstrap = await bootstrapPlatformOwnerForUser(data.user.id);
        const destination = safeNext(next, bootstrap.granted);
        return Response.redirect(`${url.origin}${destination}`, 303);
      },
    },
  },
});
