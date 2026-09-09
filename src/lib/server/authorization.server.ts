/**
 * AuthorizationService
 *
 * The single place that answers "may this actor do this, to this
 * resource?". Every protected operation evaluates, in order:
 * authentication → identity → role → permission → resource ownership
 * → security policy. The database's row-level rules reinforce these
 * decisions; they do not replace them.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { recordAudit } from "./audit.server";
import type { VaultContext } from "./context.server";
import { VaultError } from "./security.server";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export async function rolesFor(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new VaultError("Could not verify your permissions.", "forbidden");
  return (data ?? []).map((row) => row.role);
}

export async function accountStatus(userId: string): Promise<"active" | "disabled"> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  return data?.status ?? "active";
}

export async function assertActiveAccount(userId: string): Promise<void> {
  if ((await accountStatus(userId)) === "disabled") {
    throw new VaultError("This account has been disabled.", "forbidden");
  }
}

export async function isPlatformStaff(userId: string): Promise<boolean> {
  const roles = await rolesFor(userId);
  return roles.includes("admin") || roles.includes("platform_owner");
}

/** Throws unless the user holds an administrative role. */
export async function assertPlatformStaff(userId: string): Promise<AppRole[]> {
  const roles = await rolesFor(userId);
  if (!roles.includes("admin") && !roles.includes("platform_owner")) {
    await recordAudit({
      action: "AUTHORIZATION_DENIED",
      actor: { id: userId, type: "user", label: userId },
      severity: "warning",
      success: false,
      detail: { required: "admin", scope: "admin_console" },
    });
    throw new VaultError("Administrator access is required.", "forbidden");
  }
  return roles;
}

export async function assertPlatformOwner(userId: string): Promise<void> {
  const roles = await rolesFor(userId);
  if (!roles.includes("platform_owner")) {
    await recordAudit({
      action: "AUTHORIZATION_DENIED",
      actor: { id: userId, type: "user", label: userId },
      severity: "warning",
      success: false,
      detail: { required: "platform_owner" },
    });
    throw new VaultError("Platform owner access is required.", "forbidden");
  }
}

/**
 * Resolves a project **and** proves the actor may act on it.
 * A forged project id fails here, before any data is read.
 */
export async function authorizeProject(
  context: VaultContext,
  projectId: string,
  permission?: string,
): Promise<ProjectRow> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
    throw new VaultError("That project could not be found.", "not_found");
  }

  if (permission) assertPermission(context, permission);

  if (context.actor.projectScope && !context.actor.projectScope.includes(projectId)) {
    await denied(context, projectId, permission, "project_out_of_scope");
    throw new VaultError("That project could not be found.", "not_found");
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new VaultError("Could not open that project.", "storage");
  if (!data) throw new VaultError("That project could not be found.", "not_found");

  if (data.owner_id !== context.ownerId) {
    await denied(context, projectId, permission, "not_owner");
    // Deliberately indistinguishable from "missing": no existence oracle.
    throw new VaultError("That project could not be found.", "not_found");
  }

  return data;
}

/** Non-human actors carry an explicit, project-scoped permission set. */
export function assertPermission(context: VaultContext, permission: string): void {
  const granted = context.actor.permissions;
  if (!granted) return; // human actors are governed by ownership
  if (granted.includes(permission)) return;

  throw new VaultError(`This client is not permitted to ${permission}.`, "forbidden", {
    permission,
  });
}

async function denied(
  context: VaultContext,
  projectId: string,
  permission: string | undefined,
  reason: string,
): Promise<void> {
  await recordAudit({
    action: "AUTHORIZATION_DENIED",
    actor: context.actor,
    projectId,
    success: false,
    severity: "warning",
    targetType: "project",
    detail: { reason, permission: permission ?? null, clientId: context.actor.clientId ?? null },
    correlationId: context.correlationId,
  });
}
