/**
 * AuditService
 *
 * Append-only record of who did what. Writes go through the privileged
 * client because the audit trail must not be suppressible by the actor
 * being audited — no app role can update or delete audit rows.
 *
 * Secret values are never recorded; callers pass only identifiers,
 * paths and counts in `detail`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type ActorType = Database["public"]["Enums"]["actor_type"];

export type AuditActor = {
  id: string | null;
  type: ActorType;
  label: string;
};

export type AuditEntry = {
  action: string;
  actor: AuditActor;
  projectId?: string | null;
  targetType?: string | null;
  targetPath?: string | null;
  targetId?: string | null;
  success?: boolean;
  severity?: "info" | "notice" | "warning" | "critical";
  detail?: Record<string, unknown>;
  correlationId?: string | null;
};

const SECRET_KEY_PATTERN = /(token|password|secret|key|authorization|cookie)/i;

/** Defence in depth: strip anything that smells like a credential. */
function sanitizeDetail(detail: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!detail) return {};
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    if (typeof value === "string" && value.length > 500) {
      safe[key] = `${value.slice(0, 500)}…`;
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("audit_events").insert({
      action: entry.action,
      actor_id: entry.actor.id,
      actor_type: entry.actor.type,
      actor_label: entry.actor.label,
      project_id: entry.projectId ?? null,
      target_type: entry.targetType ?? null,
      target_path: entry.targetPath ?? null,
      target_id: entry.targetId ?? null,
      success: entry.success ?? true,
      severity: entry.severity ?? "info",
      detail: sanitizeDetail(entry.detail) as never,
      correlation_id: entry.correlationId ?? null,
    });

    if (error) console.error("[audit] failed to record event", entry.action, error.message);
  } catch (error) {
    // Auditing must never break the operation it is recording, but a
    // failure here is itself important, so it is logged loudly.
    console.error("[audit] unexpected failure", entry.action, error);
  }
}
