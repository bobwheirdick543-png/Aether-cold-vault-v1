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
  try {
    const me = await getSessionProfile();
    if (!me.roles.some((role) => ['admin', 'platform_owner', 'super_admin'].includes(role))) {
      throw redirect({ to: '/admin/login' });
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'to' in error) throw error;
    throw redirect({ to: '/admin/login' });
  }
}
