import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { machineContext } from "./context.server";
import { authorizeProject } from "./authorization.server";
import {
  listNodes,
  readFile,
  createFile,
  updateFile,
  createFolder,
  renameNode,
  moveNode,
  deleteNode,
  getNodeByPath,
  toVaultNode,
} from "./files.server";
import { recordAudit } from "./audit.server";
import { VaultError } from "./security.server";

export type McpPrincipal = {
  ownerId: string;
  clientId: string;
  label: string;
  permissions: string[];
  projectScope: string[];
  expiresAt: number;
};

export const MCP_SCOPES = [
  "project.read",
  "project.search",
  "file.read",
  "file.create",
  "file.update",
  "file.rename",
  "file.move",
  "file.delete",
  "folder.create",
  "folder.rename",
  "folder.move",
  "folder.delete",
  "snapshot.create",
  "snapshot.restore",
  "snapshot.read",
  "archive.import",
  "archive.export",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export async function hashMcpToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyMcpToken(token: string): Promise<McpPrincipal | null> {
  const tokenHash = await hashMcpToken(token);
  const { data, error } = await supabaseAdmin
    .from("mcp_clients")
    .select("id,owner_id,name,scopes,project_ids,expires_at,revoked_at,request_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;
  if (!data.expires_at || new Date(data.expires_at).getTime() <= Date.now()) return null;

  await supabaseAdmin
    .from("mcp_clients")
    .update({
      last_used_at: new Date().toISOString(),
      request_count: (data.request_count ?? 0) + 1,
    })
    .eq("id", data.id);

  return {
    ownerId: data.owner_id,
    clientId: data.id,
    label: data.name,
    permissions: data.scopes ?? [],
    projectScope: data.project_ids ?? [],
    expiresAt: Math.floor(new Date(data.expires_at).getTime() / 1000),
  };
}

function projectAllowed(principal: McpPrincipal, projectId: string): boolean {
  return principal.projectScope.length === 0 || principal.projectScope.includes(projectId);
}

function requireScope(principal: McpPrincipal, scope: string): void {
  if (!principal.permissions.includes(scope)) {
    throw new Error(`MCP client is not authorized for ${scope}.`);
  }
}

function requireProject(principal: McpPrincipal, projectId: string): void {
  if (!projectAllowed(principal, projectId)) {
    throw new Error("MCP client is not authorized for this project.");
  }
}

function mcpError(err: unknown): never {
  if (err instanceof VaultError) throw new Error(err.message);
  if (err instanceof Error) throw err;
  throw new Error("MCP operation failed.");
}

export function createVaultMcpServer(principal: McpPrincipal) {
  const server = new McpServer(
    {
      name: "Aether Code Vault",
      version: "1.0.0",
      description: "Scoped access to authorized Aether Code Vault projects for ChatGPT, Claude, and Grok.",
    },
    { capabilities: { tools: {} } },
  );

  const vault = machineContext({
    ownerId: principal.ownerId,
    clientId: principal.clientId,
    label: principal.label,
    permissions: principal.permissions,
    projectScope: principal.projectScope,
  });

  if (principal.permissions.includes("project.read")) {
    server.registerTool(
      "list_projects",
      {
        title: "List authorized projects",
        description: "List projects this MCP client is authorized to access.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async () => {
        try {
          let query = supabaseAdmin
            .from("projects")
            .select("id,name,description,status,file_count,folder_count,storage_bytes,current_version,created_at,updated_at")
            .eq("owner_id", principal.ownerId)
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(200);
          if (principal.projectScope.length > 0) {
            query = query.in("id", principal.projectScope);
          }
          const { data, error } = await query;
          if (error) throw new Error("Could not list projects.");
          await recordAudit({
            actor: vault.actor,
            action: "MCP_LIST_PROJECTS",
            detail: { count: (data ?? []).length },
            correlationId: vault.correlationId,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(data ?? []) }],
            structuredContent: { projects: data ?? [] },
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );

    server.registerTool(
      "get_project",
      {
        title: "Get project",
        description: "Retrieve metadata for an authorized project.",
        inputSchema: z.object({ projectId: z.string().uuid() }),
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ projectId }) => {
        try {
          requireProject(principal, projectId);
          await authorizeProject(vault, projectId, "project.read");
          const { data, error } = await supabaseAdmin
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .eq("owner_id", principal.ownerId)
            .maybeSingle();
          if (error || !data) throw new Error("Project not found.");
          await recordAudit({
            actor: vault.actor,
            action: "MCP_GET_PROJECT",
            projectId,
            targetType: "project",
            targetId: projectId,
            correlationId: vault.correlationId,
            detail: {},
          });
          return {
            content: [{ type: "text", text: JSON.stringify(data) }],
            structuredContent: data,
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );

    server.registerTool(
      "list_files",
      {
        title: "List project files",
        description: "List the authorized project's real file and folder metadata.",
        inputSchema: z.object({ projectId: z.string().uuid() }),
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ projectId }) => {
        try {
          requireScope(principal, "project.read");
          requireProject(principal, projectId);
          const nodes = await listNodes(vault, projectId);
          await recordAudit({
            actor: vault.actor,
            action: "MCP_LIST_FILES",
            projectId,
            detail: { count: nodes.length },
            correlationId: vault.correlationId,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(nodes) }],
            structuredContent: { nodes },
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );
  }

  if (principal.permissions.includes("file.read")) {
    server.registerTool(
      "read_file",
      {
        title: "Read file",
        description: "Read an authorized project file. Sensitive files remain blocked by vault policy.",
        inputSchema: z.object({
          projectId: z.string().uuid(),
          path: z.string().min(1).max(4096),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ projectId, path }) => {
        try {
          requireScope(principal, "file.read");
          requireProject(principal, projectId);
          const result = await readFile(vault, projectId, path);
          await recordAudit({
            actor: vault.actor,
            action: "MCP_READ_FILE",
            projectId,
            targetType: "file",
            targetPath: path,
            detail: { bytes: result.content.length },
            correlationId: vault.correlationId,
          });
          return {
            content: [{ type: "text", text: result.content }],
            structuredContent: { path, encoding: result.encoding, content: result.content },
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );
  }

  if (principal.permissions.includes("project.search")) {
    server.registerTool(
      "search_files",
      {
        title: "Search project files",
        description: "Search filenames and paths within an authorized project.",
        inputSchema: z.object({
          projectId: z.string().uuid(),
          query: z.string().min(1).max(200),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async ({ projectId, query }) => {
        try {
          requireScope(principal, "project.search");
          requireProject(principal, projectId);
          const nodes = await listNodes(vault, projectId);
          const q = query.toLowerCase();
          const matches = nodes.filter((n) => n.path.toLowerCase().includes(q));
          await recordAudit({
            actor: vault.actor,
            action: "MCP_SEARCH_FILES",
            projectId,
            detail: { query, count: matches.length },
            correlationId: vault.correlationId,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(matches) }],
            structuredContent: { matches },
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );
  }

  if (principal.permissions.includes("file.create")) {
    server.registerTool(
      "create_file",
      {
        title: "Create file",
        description: "Create a new file with the given content in an authorized project.",
        inputSchema: z.object({
          projectId: z.string().uuid(),
          path: z.string().min(1).max(4096),
          content: z.string().default(""),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ projectId, path, content }) => {
        try {
          requireScope(principal, "file.create");
          requireProject(principal, projectId);
          const node = await createFile(vault, projectId, path, content);
          await recordAudit({
            actor: vault.actor,
            action: "MCP_CREATE_FILE",
            projectId,
            targetType: "file",
            targetPath: path,
            targetId: node.id,
            detail: { bytes: content.length },
            correlationId: vault.correlationId,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(node) }],
            structuredContent: node,
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );
  }

  if (principal.permissions.includes("file.update")) {
    server.registerTool(
      "update_file",
      {
        title: "Update file",
        description: "Overwrite the content of an existing file in an authorized project.",
        inputSchema: z.object({
          projectId: z.string().uuid(),
          path: z.string().min(1).max(4096),
          content: z.string(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ projectId, path, content }) => {
        try {
          requireScope(principal, "file.update");
          requireProject(principal, projectId);
          const node = await updateFile(vault, projectId, path, content);
          await recordAudit({
            actor: vault.actor,
            action: "MCP_UPDATE_FILE",
            projectId,
            targetType: "file",
            targetPath: path,
            targetId: node.id,
            detail: { bytes: content.length },
            correlationId: vault.correlationId,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(node) }],
            structuredContent: node,
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );
  }

  if (principal.permissions.includes("folder.create")) {
    server.registerTool(
      "create_folder",
      {
        title: "Create folder",
        description: "Create a folder in an authorized project.",
        inputSchema: z.object({
          projectId: z.string().uuid(),
          path: z.string().min(1).max(4096),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ projectId, path }) => {
        try {
          requireScope(principal, "folder.create");
          requireProject(principal, projectId);
          const node = await createFolder(vault, projectId, path);
          await recordAudit({
            actor: vault.actor,
            action: "MCP_CREATE_FOLDER",
            projectId,
            targetType: "folder",
            targetPath: path,
            targetId: node.id,
            correlationId: vault.correlationId,
            detail: {},
          });
          return {
            content: [{ type: "text", text: JSON.stringify(node) }],
            structuredContent: node,
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );
  }

  if (principal.permissions.includes("snapshot.create")) {
    server.registerTool(
      "create_snapshot",
      {
        title: "Create snapshot",
        description: "Create a real point-in-time snapshot before AI modifications.",
        inputSchema: z.object({
          projectId: z.string().uuid(),
          label: z.string().trim().min(1).max(120),
          message: z.string().max(500).default(""),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      async ({ projectId, label, message }) => {
        try {
          requireScope(principal, "snapshot.create");
          requireProject(principal, projectId);
          await authorizeProject(vault, projectId, "snapshot.create");
          const nodes = await listNodes(vault, projectId);
          const { data: latest } = await supabaseAdmin
            .from("snapshots")
            .select("version")
            .eq("project_id", projectId)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          const version = Number(latest?.version ?? 0) + 1;
          const { data: snapshot, error } = await supabaseAdmin
            .from("snapshots")
            .insert({
              project_id: projectId,
              created_by: principal.ownerId,
              version,
              label,
              message,
              origin: "mcp",
              file_count: nodes.filter((n) => n.type === "file").length,
              folder_count: nodes.filter((n) => n.type === "folder").length,
              storage_bytes: nodes.reduce((sum, n) => sum + n.sizeBytes, 0),
            })
            .select("*")
            .single();
          if (error || !snapshot) throw new Error("Could not create snapshot.");
          await recordAudit({
            actor: vault.actor,
            action: "MCP_CREATE_SNAPSHOT",
            projectId,
            targetType: "snapshot",
            targetId: snapshot.id,
            detail: { version, label },
            correlationId: vault.correlationId,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(snapshot) }],
            structuredContent: snapshot,
          };
        } catch (e) {
          mcpError(e);
        }
      },
    );
  }

  return server;
}
