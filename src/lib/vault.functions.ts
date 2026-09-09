import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { userContext } from "@/lib/server/context.server";
import { createFile, createFolder, listNodes, readFile, updateFile, writeFileBytes, type VaultNode } from "@/lib/server/files.server";
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
  return userContext({ db: ctx.supabase, userId: ctx.userId, label: data?.display_name || data?.email || "User" });
}

export const getSessionProfile = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: profile } = await context.supabase.from("profiles").select("id,email,display_name,status").eq("id", context.userId).maybeSingle();
  const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  return { profile, roles: (roles ?? []).map((r: { role: string }) => r.role) };
});

export const getProjects = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("projects").select("id,name,description,status,file_count,folder_count,storage_bytes,current_version,created_at,updated_at").eq("owner_id", context.userId).order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load your projects."); return data ?? [];
});

export const createProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(createProjectSchema).handler(async ({ context, data }) => {
  const name = data.name.replace(/[\\/\u0000-\u001f]/g, "-").trim(); if (!name) throw new Error("Project name is required.");
  const { data: project, error } = await context.supabase.from("projects").insert({ owner_id: context.userId, name, description: data.description }).select("*").single();
  if (error || !project) throw new Error("Could not create the project.");
  await recordAudit({ actor: { id: context.userId, type: "user", label: name }, action: "PROJECT_CREATE", projectId: project.id, targetType: "project", targetId: project.id, targetPath: name, detail: {}, correlationId: crypto.randomUUID() }); return project;
});

export const getProject = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator(projectIdSchema).handler(async ({ context, data }) => {
  const { data: project, error } = await context.supabase.from("projects").select("*").eq("id", data.projectId).eq("owner_id", context.userId).maybeSingle();
  if (error) throw new Error("Could not load the project."); if (!project) throw new Error("Project not found."); return project;
});
export const getProjectNodes = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator(projectIdSchema).handler(async ({ context, data }) => listNodes(await contextFor(context), data.projectId));
export const getProjectFile = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator(fileSchema).handler(async ({ context, data }) => readFile(await contextFor(context), data.projectId, data.path));
export const saveProjectFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(saveSchema).handler(async ({ context, data }) => updateFile(await contextFor(context), data.projectId, data.path, data.content));
export const createProjectFile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(z.object({ projectId: z.string().uuid(), path: z.string().min(1), content: z.string().default("") })).handler(async ({ context, data }) => createFile(await contextFor(context), data.projectId, data.path, data.content));
export const createProjectFolder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(createNodeSchema).handler(async ({ context, data }) => createFolder(await contextFor(context), data.projectId, data.path));

export const getSnapshots = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator(projectIdSchema).handler(async ({ context, data }) => {
  const { data: rows, error } = await context.supabase.from("snapshots").select("*").eq("project_id", data.projectId).eq("created_by", context.userId).order("version", { ascending: false });
  if (error) throw new Error("Could not load snapshots."); return rows ?? [];
});

export const createSnapshot = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(z.object({ projectId: z.string().uuid(), label: z.string().trim().min(1).max(120), message: z.string().max(500).default("") })).handler(async ({ context, data }) => {
  const vault = await contextFor(context); await authorizeProject(vault, data.projectId, "snapshot.create"); const nodes = await listNodes(vault, data.projectId);
  const { data: latest } = await context.supabase.from("snapshots").select("version").eq("project_id", data.projectId).order("version", { ascending: false }).limit(1).maybeSingle(); const version = Number(latest?.version ?? 0) + 1;
  const { data: snapshot, error } = await context.supabase.from("snapshots").insert({ project_id: data.projectId, created_by: context.userId, version, label: data.label, message: data.message, origin: "manual", file_count: nodes.filter((n: VaultNode) => n.type === "file").length, folder_count: nodes.filter((n: VaultNode) => n.type === "folder").length, storage_bytes: nodes.reduce((sum: number, n: VaultNode) => sum + n.sizeBytes, 0) }).select("*").single();
  if (error || !snapshot) throw new Error("Could not create snapshot.");
  const { data: rawNodes } = await context.supabase.from("project_nodes").select("path,type,mime_type,size_bytes,content_hash,storage_key,is_sensitive").eq("project_id", data.projectId).order("path");
  if (rawNodes?.length) { const { error: entryError } = await context.supabase.from("snapshot_entries").insert(rawNodes.map((n: any) => ({ snapshot_id: snapshot.id, project_id: data.projectId, path: n.path, type: n.type, mime_type: n.mime_type, size_bytes: n.size_bytes, content_hash: n.content_hash, storage_key: n.storage_key, is_sensitive: n.is_sensitive }))); if (entryError) throw new Error("Snapshot metadata could not be stored."); }
  await context.supabase.from("projects").update({ current_version: version }).eq("id", data.projectId).eq("owner_id", context.userId);
  await recordAudit({ actor: vault.actor, action: "SNAPSHOT_CREATE", projectId: data.projectId, targetType: "snapshot", targetId: snapshot.id, targetPath: data.label, detail: { version, entries: rawNodes?.length ?? 0 }, correlationId: vault.correlationId }); return snapshot;
});

export const restoreSnapshot = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(z.object({ projectId: z.string().uuid(), snapshotId: z.string().uuid() })).handler(async ({ context, data }) => {
  const vault = await contextFor(context); await authorizeProject(vault, data.projectId, "snapshot.restore");
  const { data: snapshot } = await context.supabase.from("snapshots").select("*").eq("id", data.snapshotId).eq("project_id", data.projectId).maybeSingle(); if (!snapshot) throw new Error("Snapshot not found.");
  const { data: entries, error: entryError } = await context.supabase.from("snapshot_entries").select("*").eq("snapshot_id", data.snapshotId).order("path"); if (entryError) throw new Error("Could not read the snapshot.");
  const { error: deleteError } = await context.supabase.from("project_nodes").delete().eq("project_id", data.projectId); if (deleteError) throw new Error("Could not prepare the project for restore.");
  for (const entry of (entries ?? []) as any[]) { if (entry.type === "folder") await createFolder(vault, data.projectId, entry.path); else { const bytes = entry.storage_key ? await vault.storage.get(entry.storage_key) : new Uint8Array(); await writeFileBytes(vault, data.projectId, entry.path, bytes, { silent: true, deferStats: true }); } }
  const { data: latest } = await context.supabase.from("snapshots").select("version").eq("project_id", data.projectId).order("version", { ascending: false }).limit(1).maybeSingle(); const nextVersion = Number(latest?.version ?? 0) + 1;
  const { data: restored } = await context.supabase.from("snapshots").insert({ project_id: data.projectId, created_by: context.userId, version: nextVersion, label: `Restore: ${snapshot.label}`, message: `Restored from snapshot v${snapshot.version}.`, origin: "restore", file_count: snapshot.file_count, folder_count: snapshot.folder_count, storage_bytes: snapshot.storage_bytes }).select("*").single();
  await context.supabase.from("projects").update({ current_version: nextVersion }).eq("id", data.projectId).eq("owner_id", context.userId);
  await recordAudit({ actor: vault.actor, action: "SNAPSHOT_RESTORE", projectId: data.projectId, targetType: "snapshot", targetId: data.snapshotId, detail: { sourceVersion: snapshot.version, restoredVersion: nextVersion }, correlationId: vault.correlationId }); return restored;
});

export const getMcpClients = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { const { data, error } = await context.supabase.from("mcp_clients").select("id,name,description,token_prefix,scopes,project_ids,expires_at,revoked_at,last_used_at,last_protocol_version,request_count,created_at").eq("owner_id", context.userId).order("created_at", { ascending: false }); if (error) throw new Error("Could not load MCP clients."); return data ?? []; });
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
