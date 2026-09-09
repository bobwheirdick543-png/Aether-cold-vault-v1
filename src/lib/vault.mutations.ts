import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userContext } from "@/lib/server/context.server";
import { deleteNode, moveNode, renameNode } from "@/lib/server/files.server";
import { recordAudit } from "@/lib/server/audit.server";

const projectIdSchema = z.object({ projectId: z.string().uuid() });
const nodeIdSchema = z.object({ projectId: z.string().uuid(), nodeId: z.string().uuid() });
const renameNodeSchema = nodeIdSchema.extend({ newName: z.string().trim().min(1).max(255) });
const moveNodeSchema = nodeIdSchema.extend({ destinationFolderPath: z.string().trim().max(4096).nullable() });
const projectRenameSchema = projectIdSchema.extend({ name: z.string().trim().min(1).max(120) });

async function contextFor(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("profiles")
    .select("display_name,email")
    .eq("id", ctx.userId)
    .maybeSingle();
  return userContext({
    db: ctx.supabase,
    userId: ctx.userId,
    label: data?.display_name || data?.email || "User",
  });
}

export const renameProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(projectRenameSchema)
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    const { data: project, error: readError } = await context.supabase
      .from("projects")
      .select("id,name,status")
      .eq("id", data.projectId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (readError || !project) throw new Error("Project not found.");
    const name = data.name.replace(/[\\/\u0000-\u001f]/g, "-").trim();
    const { data: updated, error } = await context.supabase
      .from("projects")
      .update({ name })
      .eq("id", data.projectId)
      .eq("owner_id", context.userId)
      .select("*")
      .single();
    if (error || !updated) throw new Error("Could not rename the project.");
    await recordAudit({ actor: vault.actor, action: "PROJECT_RENAME", projectId: data.projectId, targetType: "project", targetId: data.projectId, targetPath: name, detail: { from: project.name, to: name }, correlationId: vault.correlationId });
    return updated;
  });

export const setProjectArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(projectIdSchema.extend({ archived: z.boolean() }))
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    const { data: project, error } = await context.supabase
      .from("projects")
      .update({ status: data.archived ? "archived" : "active" })
      .eq("id", data.projectId)
      .eq("owner_id", context.userId)
      .select("*")
      .maybeSingle();
    if (error || !project) throw new Error("Could not update the project status.");
    await recordAudit({ actor: vault.actor, action: data.archived ? "PROJECT_ARCHIVE" : "PROJECT_UNARCHIVE", projectId: data.projectId, targetType: "project", targetId: data.projectId, detail: { status: project.status }, correlationId: vault.correlationId });
    return project;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(projectIdSchema)
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    const { data: project, error: readError } = await context.supabase
      .from("projects")
      .select("id,name")
      .eq("id", data.projectId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (readError || !project) throw new Error("Project not found.");

    // Remove the private content-addressed blobs before deleting the DB row.
    await vault.storage.removePrefix(`${data.projectId}/blobs`);
    const { error } = await context.supabase
      .from("projects")
      .delete()
      .eq("id", data.projectId)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not delete the project.");
    await recordAudit({ actor: vault.actor, action: "PROJECT_DELETE", projectId: data.projectId, targetType: "project", targetId: data.projectId, targetPath: project.name, detail: {}, correlationId: vault.correlationId });
    return { success: true };
  });

export const renameProjectNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(renameNodeSchema)
  .handler(async ({ context, data }) => renameNode(await contextFor(context), data.projectId, data.nodeId, data.newName));

export const moveProjectNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(moveNodeSchema)
  .handler(async ({ context, data }) => moveNode(await contextFor(context), data.projectId, data.nodeId, data.destinationFolderPath || null));

export const deleteProjectNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(nodeIdSchema)
  .handler(async ({ context, data }) => deleteNode(await contextFor(context), data.projectId, data.nodeId));
