import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userContext } from "@/lib/server/context.server";
import {
  createFile,
  createFolder,
  listNodes,
  readFile,
  updateFile,
  type VaultNode,
} from "@/lib/server/files.server";
import { authorizeProject } from "@/lib/server/authorization.server";
import { recordAudit } from "@/lib/server/audit.server";
import type { Database } from "@/integrations/supabase/types";

const projectIdSchema = z.object({ projectId: z.string().uuid() });
const fileSchema = z.object({ projectId: z.string().uuid(), path: z.string().min(1) });
const saveSchema = z.object({ projectId: z.string().uuid(), path: z.string().min(1), content: z.string() });
const createProjectSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(500).default("") });
const createNodeSchema = z.object({ projectId: z.string().uuid(), path: z.string().min(1) });

async function contextFor(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("profiles").select("display_name,email").eq("id", ctx.userId).maybeSingle();
  return userContext({
    db: ctx.supabase,
    userId: ctx.userId,
    label: data?.display_name || data?.email || "User",
  });
}

export const getSessionProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("id,email,display_name,status").eq("id", context.userId).maybeSingle();
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return { profile, roles: (roles ?? []).map((r: { role: string }) => r.role) };
  });

export const getProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id,name,description,status,file_count,folder_count,storage_bytes,current_version,created_at,updated_at")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Could not load your projects.");
    return data ?? [];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(createProjectSchema)
  .handler(async ({ context, data }) => {
    const name = data.name.replace(/[\\/\u0000-\u001f]/g, "-").trim();
    if (!name) throw new Error("Project name is required.");
    const { data: project, error } = await context.supabase
      .from("projects")
      .insert({ owner_id: context.userId, name, description: data.description })
      .select("*")
      .single();
    if (error || !project) throw new Error("Could not create the project.");
    await recordAudit({ actor: { id: context.userId, type: "user", label: name }, action: "PROJECT_CREATE", projectId: project.id, targetType: "project", targetId: project.id, targetPath: name, detail: {}, correlationId: crypto.randomUUID() });
    return project;
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(projectIdSchema)
  .handler(async ({ context, data }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("*")
      .eq("id", data.projectId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load the project.");
    if (!project) throw new Error("Project not found.");
    return project;
  });

export const getProjectNodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(projectIdSchema)
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    return listNodes(vault, data.projectId);
  });

export const getProjectFile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(fileSchema)
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    return readFile(vault, data.projectId, data.path);
  });

export const saveProjectFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(saveSchema)
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    return updateFile(vault, data.projectId, data.path, data.content);
  });

export const createProjectFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ projectId: z.string().uuid(), path: z.string().min(1), content: z.string().default("") }))
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    return createFile(vault, data.projectId, data.path, data.content);
  });

export const createProjectFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(createNodeSchema)
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    return createFolder(vault, data.projectId, data.path);
  });

export const getSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(projectIdSchema)
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.from("snapshots").select("*").eq("project_id", data.projectId).order("version", { ascending: false });
    if (error) throw new Error("Could not load snapshots.");
    return rows ?? [];
  });

export const createSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ projectId: z.string().uuid(), label: z.string().trim().min(1).max(120), message: z.string().max(500).default("") }))
  .handler(async ({ context, data }) => {
    const vault = await contextFor(context);
    await authorizeProject(vault, data.projectId, "snapshot.create");
    const nodes = await listNodes(vault, data.projectId);
    const { data: latest } = await context.supabase.from("snapshots").select("version").eq("project_id", data.projectId).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = Number(latest?.version ?? 0) + 1;
    const { data: snapshot, error } = await context.supabase.from("snapshots").insert({ project_id: data.projectId, created_by: context.userId, version, label: data.label, message: data.message, origin: "manual", file_count: nodes.filter((n: VaultNode) => n.type === "file").length, folder_count: nodes.filter((n: VaultNode) => n.type === "folder").length, storage_bytes: nodes.reduce((sum: number, n: VaultNode) => sum + n.sizeBytes, 0) }).select("*").single();
    if (error || !snapshot) throw new Error("Could not create snapshot.");
    if (nodes.length) {
      const entries = nodes.map((n: VaultNode) => ({ snapshot_id: snapshot.id, project_id: data.projectId, path: n.path, type: n.type, mime_type: n.mimeType, size_bytes: n.sizeBytes, content_hash: n.contentHash, storage_key: null, is_sensitive: n.isSensitive }));
      const { error: entryError } = await context.supabase.from("snapshot_entries").insert(entries);
      if (entryError) throw new Error("Snapshot metadata could not be stored.");
    }
    await context.supabase.from("projects").update({ current_version: version }).eq("id", data.projectId).eq("owner_id", context.userId);
    await recordAudit({ actor: vault.actor, action: "SNAPSHOT_CREATE", projectId: data.projectId, targetType: "snapshot", targetId: snapshot.id, targetPath: data.label, detail: { version, fileCount: nodes.length }, correlationId: vault.correlationId });
    return snapshot;
  });

export const getMcpClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("mcp_clients").select("id,name,description,token_prefix,scopes,project_ids,expires_at,revoked_at,last_used_at,last_protocol_version,request_count,created_at").eq("owner_id", context.userId).order("created_at", { ascending: false });
    if (error) throw new Error("Could not load MCP clients.");
    return data ?? [];
  });

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
