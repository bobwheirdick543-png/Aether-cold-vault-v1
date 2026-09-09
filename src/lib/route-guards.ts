import { redirect } from '@tanstack/react-router';
import { getSessionProfile } from '@/lib/vault.functions';

export async function requireUserRoute() {
  try {
    await getSessionProfile();
  } catch {
    throw redirect({ to: '/login' });
  }
}

export async function requireAdminRoute() {
  let me: Awaited<ReturnType<typeof getSessionProfile>>;
  try {
    me = await getSessionProfile();
  } catch {
    throw redirect({ to: '/admin/login' });
  }

  if (!me.roles.some((role) => ['admin', 'platform_owner', 'super_admin'].includes(role))) {
    throw redirect({ to: '/admin/login' });
  }
}
