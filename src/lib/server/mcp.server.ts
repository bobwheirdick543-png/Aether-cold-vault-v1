import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { machineContext } from "./context.server";
import { authorizeProject } from "./authorization.server";
import { listNodes, readFile } from "./files.server";
import { recordAudit } from "./audit.server";

export type McpPrincipal = { ownerId: string; clientId: string; label: string; permissions: string[]; projectScope: string[]; expiresAt: number };

export async function hashMcpToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyMcpToken(token: string): Promise<McpPrincipal | null> {
  const tokenHash = await hashMcpToken(token);
  const { data, error } = await supabaseAdmin.from("mcp_clients").select("id,owner_id,name,scopes,project_ids,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (error || !data || data.revoked_at) return null;
  if (!data.expires_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  await supabaseAdmin.from("mcp_clients").update({ last_used_at: new Date().toISOString(), request_count: 1 }).eq("id", data.id);
  return { ownerId: data.owner_id, clientId: data.id, label: data.name, permissions: data.scopes ?? [], projectScope: data.project_ids ?? [], expiresAt: Math.floor(new Date(data.expires_at).getTime() / 1000) };
}

function projectAllowed(principal: McpPrincipal, projectId: string) { return principal.projectScope.length === 0 || principal.projectScope.includes(projectId); }
function requireScope(principal: McpPrincipal, scope: string) { if (!principal.permissions.includes(scope)) throw new Error(`MCP client is not authorized for ${scope}.`); }
function requireProject(principal: McpPrincipal, projectId: string) { if (!projectAllowed(principal, projectId)) throw new Error("MCP client is not authorized for this project."); }

export function createVaultMcpServer(principal: McpPrincipal) {
  const server = new McpServer({ name: "Aether Code Vault", version: "1.0.0", description: "Scoped access to authorized Aether Code Vault projects." }, { capabilities: { tools: {} } });
  const vault = machineContext({ ownerId: principal.ownerId, clientId: principal.clientId, label: principal.label, permissions: principal.permissions, projectScope: principal.projectScope });

  server.registerTool("list_projects", { title: "List authorized projects", description: "List projects this MCP client is allowed to access.", inputSchema: z.object({}), annotations: { readOnlyHint: true, destructiveHint: false } }, async () => {
    requireScope(principal, "project.read");
    const { data, error } = await supabaseAdmin.from("projects").select("id,name,description,status,file_count,folder_count,storage_bytes,current_version,updated_at").eq("owner_id", principal.ownerId).order("updated_at", { ascending: false });
    if (error) throw error;
    const projects = (data ?? []).filter(p => projectAllowed(principal, p.id));
    await recordAudit({ actor: vault.actor, action: "MCP_LIST_PROJECTS", detail: { count: projects.length }, correlationId: vault.correlationId });
    return { content: [{ type: "text", text: JSON.stringify(projects) }], structuredContent: { projects } };
  });

  server.registerTool("get_project", { title: "Get project", description: "Read metadata for one authorized project.", inputSchema: z.object({ projectId: z.string().uuid() }), annotations: { readOnlyHint: true, destructiveHint: false } }, async ({ projectId }) => {
    requireScope(principal, "project.read"); requireProject(principal, projectId); await authorizeProject(vault, projectId, "project.read");
    const { data, error } = await supabaseAdmin.from("projects").select("id,name,description,status,file_count,folder_count,storage_bytes,current_version,created_at,updated_at").eq("id", projectId).eq("owner_id", principal.ownerId).maybeSingle(); if (error || !data) throw new Error("Project not found.");
    await recordAudit({ actor: vault.actor, action: "MCP_GET_PROJECT", projectId, targetType: "project", targetId: projectId, correlationId: vault.correlationId, detail: {} }); return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  });

  server.registerTool("list_files", { title: "List project files", description: "List the authorized project's real file and folder metadata.", inputSchema: z.object({ projectId: z.string().uuid() }), annotations: { readOnlyHint: true, destructiveHint: false } }, async ({ projectId }) => {
    requireScope(principal, "project.read"); requireProject(principal, projectId); const nodes = await listNodes(vault, projectId); await recordAudit({ actor: vault.actor, action: "MCP_LIST_FILES", projectId, detail: { count: nodes.length }, correlationId: vault.correlationId }); return { content: [{ type: "text", text: JSON.stringify(nodes) }], structuredContent: { nodes } };
  });

  server.registerTool("read_file", { title: "Read file", description: "Read an authorized project file. Sensitive files remain blocked by the vault policy unless an explicit server-side policy permits them.", inputSchema: z.object({ projectId: z.string().uuid(), path: z.string().min(1).max(4096) }), annotations: { readOnlyHint: true, destructiveHint: false } }, async ({ projectId, path }) => {
    requireScope(principal, "file.read"); requireProject(principal, projectId); const result = await readFile(vault, projectId, path); await recordAudit({ actor: vault.actor, action: "MCP_READ_FILE", projectId, targetType: "file", targetPath: path, detail: { bytes: result.content.length }, correlationId: vault.correlationId }); return { content: [{ type: "text", text: result.content }], structuredContent: { path, encoding: result.encoding, content: result.content } };
  });

  server.registerTool("search_files", { title: "Search project files", description: "Search filenames and paths within an authorized project.", inputSchema: z.object({ projectId: z.string().uuid(), query: z.string().min(1).max(200) }), annotations: { readOnlyHint: true, destructiveHint: false } }, async ({ projectId, query }) => {
    requireScope(principal, "project.search"); requireProject(principal, projectId); const nodes = await listNodes(vault, projectId); const q = query.toLowerCase(); const matches = nodes.filter(n => n.path.toLowerCase().includes(q)); await recordAudit({ actor: vault.actor, action: "MCP_SEARCH_FILES", projectId, detail: { query, count: matches.length }, correlationId: vault.correlationId }); return { content: [{ type: "text", text: JSON.stringify(matches) }], structuredContent: { matches } };
  });

  return server;
}
