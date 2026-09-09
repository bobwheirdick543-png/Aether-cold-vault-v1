import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { recordAudit } from './audit.server';

/**
 * Grants platform-owner access only when the authenticated user's email
 * matches the server-side ADMIN_EMAIL bootstrap secret.
 */
export async function bootstrapPlatformOwnerForUser(userId: string) {
  const configuredEmail = process.env['ADMIN_EMAIL']?.trim().toLowerCase();
  if (!configuredEmail) {
    return { granted: false, configured: false };
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) {
    throw new Error('Could not verify the account for administrator bootstrap.');
  }

  if (data.user.email.trim().toLowerCase() !== configuredEmail) {
    return { granted: false, configured: true };
  }

  const { error: roleError } = await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: userId, role: 'platform_owner' }, { onConflict: 'user_id,role' });

  if (roleError) {
    throw new Error('Could not initialize platform owner access.');
  }

  await recordAudit({
    actor: { id: userId, type: 'user', label: data.user.email },
    action: 'PLATFORM_OWNER_BOOTSTRAP',
    detail: { source: 'email-match' },
    correlationId: crypto.randomUUID(),
  });

  return { granted: true, configured: true };
}
