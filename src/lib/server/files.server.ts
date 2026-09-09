/**
 * FileService
 *
 * The real project filesystem. Metadata lives in the database; file
 * bytes live in private, content-addressed object storage. Every
 * mutation is authorized, validated, size-checked and audited.
 */
import { recordAudit } from "./audit.server";
import { authorizeProject } from "./authorization.server";
import type { VaultContext } from "./context.server";
import type { Database } from "@/integrations/supabase/types";
import {
  VAULT_LIMITS,
  VaultError,
  assertReadableContent,
  assertValidName,
  classifySensitivity,
  contentHash,
  detectMimeType,
  isTextMimeType,
  isWithin,
  normalizePath,
  pathDepth,
  pathName,
  pathParent,
  validationError,
} from "./security.server";

export type NodeRow = Database["public"]["Tables"]["project_nodes"]["Row"];

export type VaultNode = {
  id: string;
  parentId: string | null;
  name: string;
  type: "file" | "folder";
  path: string;
  depth: number;
  mimeType: string | null;
  sizeBytes: number;
  contentHash: string | null;
  isSensitive: boolean;
  isEditable: boolean;
  updatedAt: string;
};

export function toVaultNode(row: NodeRow): VaultNode {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    type: row.type,
    path: row.path,
    depth: row.depth,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    contentHash: row.content_hash,
    isSensitive: row.is_sensitive,
    isEditable:
      row.type === "file" &&
      isTextMimeType(row.mime_type) &&
      Number(row.size_bytes) <= VAULT_LIMITS.maxEditableBytes,
    updatedAt: row.updated_at,
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function listNodes(context: VaultContext, projectId: string): Promise<VaultNode[]> {
  await authorizeProject(context, projectId, "project.read");

  const { data, error } = await context.db
    .from("project_nodes")
    .select("*")
    .eq("project_id", projectId)
    .order("path", { ascending: true })
    .limit(VAULT_LIMITS.maxNodesPerProject);

  if (error) throw new VaultError("Could not load this project's files.", "storage");
  return (data ?? []).map(toVaultNode);
}

export async function getNodeByPath(
  context: VaultContext,
  projectId: string,
  path: string,
): Promise<NodeRow | null> {
  const { data, error } = await context.db
    .from("project_nodes")
    .select("*")
    .eq("project_id", projectId)
    .eq("path", path)
    .maybeSingle();

  if (error) throw new VaultError("Could not look up that path.", "storage");
  return data ?? null;
}

async function requireNode(
  context: VaultContext,
  projectId: string,
  nodeId: string,
): Promise<NodeRow> {
  const { data, error } = await context.db
    .from("project_nodes")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", nodeId)
    .maybeSingle();

  if (error) throw new VaultError("Could not look up that item.", "storage");
  if (!data) throw new VaultError("That file or folder no longer exists.", "not_found");
  return data;
}

export type FileContent = {
  node: VaultNode;
  encoding: "utf-8" | "base64";
  content: string;
};

export async function readFile(
  context: VaultContext,
  projectId: string,
  path: string,
  options: { allowSensitive?: boolean } = {},
): Promise<FileContent> {
  await authorizeProject(context, projectId, "file.read");
  const normalized = normalizePath(path);
  const row = await getNodeByPath(context, projectId, normalized);

  if (!row) throw new VaultError("That file no longer exists.", "not_found");
  if (row.type !== "file") throw validationError("That path is a folder, not a file.");

  assertReadableContent(row, {
    type: context.actor.type,
    isOwner: context.actor.id === context.ownerId && context.actor.type === "user",
    allowSensitive: options.allowSensitive,
  });

  const node = toVaultNode(row);

  if (!row.storage_key || row.size_bytes === 0) {
    return { node, encoding: "utf-8", content: "" };
  }

  const bytes = await context.storage.get(row.storage_key);

  await recordAudit({
    action: "FILE_READ",
    actor: context.actor,
    projectId,
    targetType: "file",
    targetPath: normalized,
    targetId: row.id,
    correlationId: context.correlationId,
    detail: { bytes: Number(row.size_bytes) },
  });

  if (isTextMimeType(row.mime_type)) {
    return { node, encoding: "utf-8", content: decoder.decode(bytes) };
  }

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { node, encoding: "base64", content: btoa(binary) };
}

/* ------------------------------------------------------------------ *
 * Internal helpers
 * ------------------------------------------------------------------ */

async function projectTotals(context: VaultContext, projectId: string) {
  const { data, error } = await context.db
    .from("project_nodes")
    .select("type,size_bytes")
    .eq("project_id", projectId)
    .limit(VAULT_LIMITS.maxNodesPerProject + 1);

  if (error) throw new VaultError("Could not measure this project.", "storage");

  const rows = data ?? [];
  return {
    nodeCount: rows.length,
    fileCount: rows.filter((row) => row.type === "file").length,
    folderCount: rows.filter((row) => row.type === "folder").length,
    storageBytes: rows.reduce((total, row) => total + Number(row.size_bytes), 0),
  };
}

/** Recomputes and persists a project's real file/size counters. */
export async function refreshProjectStats(
  context: VaultContext,
  projectId: string,
): Promise<{ fileCount: number; folderCount: number; storageBytes: number }> {
  const totals = await projectTotals(context, projectId);

  const { error } = await context.privileged
    .from("projects")
    .update({
      file_count: totals.fileCount,
      folder_count: totals.folderCount,
      storage_bytes: totals.storageBytes,
    })
    .eq("id", projectId);

  if (error) throw new VaultError("Could not update project totals.", "storage");
  return totals;
}

/** Creates every missing folder along a path, returning the parent id. */
export async function ensureFolderChain(
  context: VaultContext,
  projectId: string,
  folderPath: string | null,
): Promise<string | null> {
  if (!folderPath) return null;

  const segments = folderPath.split("/");
  let parentId: string | null = null;
  let walked = "";

  for (const segment of segments) {
    walked = walked ? `${walked}/${segment}` : segment;
    const existing = await getNodeByPath(context, projectId, walked);

    if (existing) {
      if (existing.type !== "folder") {
        throw new VaultError(`"${walked}" already exists as a file.`, "conflict");
      }
      parentId = existing.id;
      continue;
    }

    const { data, error } = await context.db
      .from("project_nodes")
      .insert({
        project_id: projectId,
        parent_id: parentId,
        name: segment,
        type: "folder",
        path: walked,
        depth: pathDepth(walked),
      })
      .select("id")
      .single();

    if (error) throw new VaultError(`Could not create folder "${walked}".`, "storage");
    parentId = data.id;
  }

  return parentId;
}

type WriteOptions = {
  /** Skips per-write auditing; used by bulk archive/restore operations. */
  silent?: boolean;
  /** Skips project stat refresh; the caller refreshes once at the end. */
  deferStats?: boolean;
};

/**
 * Creates or replaces one file's bytes. This is the single write path
 * used by the editor, ZIP import, snapshot restore and MCP writes.
 */
export async function writeFileBytes(
  context: VaultContext,
  projectId: string,
  rawPath: string,
  bytes: Uint8Array,
  options: WriteOptions = {},
): Promise<VaultNode> {
  const path = normalizePath(rawPath);

  if (bytes.byteLength > VAULT_LIMITS.maxFileBytes) {
    throw new VaultError(
      `Files must be ${Math.round(VAULT_LIMITS.maxFileBytes / 1024 / 1024)} MB or smaller.`,
      "limit",
      { path },
    );
  }

  const existing = await getNodeByPath(context, projectId, path);
  if (existing && existing.type === "folder") {
    throw new VaultError(`"${path}" is a folder.`, "conflict");
  }

  if (!existing) {
    const totals = await projectTotals(context, projectId);
    if (totals.nodeCount >= VAULT_LIMITS.maxNodesPerProject) {
      throw new VaultError(
        `Projects are limited to ${VAULT_LIMITS.maxNodesPerProject} files and folders.`,
        "limit",
      );
    }
    if (totals.storageBytes + bytes.byteLength > VAULT_LIMITS.maxProjectBytes) {
      throw new VaultError("This project has reached its storage limit.", "limit");
    }
  }

  const hash = await contentHash(bytes);
  const storageKey = context.storage.blobKey(projectId, hash);
  const mimeType = detectMimeType(path);
  const sensitivity = classifySensitivity(path);

  if (bytes.byteLength > 0 && !(await context.storage.exists(storageKey))) {
    await context.storage.put(storageKey, bytes, mimeType);
  }

  const payload = {
    project_id: projectId,
    name: pathName(path),
    type: "file" as const,
    path,
    depth: pathDepth(path),
    mime_type: mimeType,
    size_bytes: bytes.byteLength,
    content_hash: hash,
    storage_key: bytes.byteLength > 0 ? storageKey : null,
    is_sensitive: sensitivity.isSensitive,
  };

  let row: NodeRow;

  if (existing) {
    const { data, error } = await context.db
      .from("project_nodes")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new VaultError("Could not save that file.", "storage", { path });
    row = data;
  } else {
    const parentId = await ensureFolderChain(context, projectId, pathParent(path));
    const { data, error } = await context.db
      .from("project_nodes")
      .insert({ ...payload, parent_id: parentId })
      .select("*")
      .single();
    if (error) throw new VaultError("Could not create that file.", "storage", { path });
    row = data;
  }

  if (!options.deferStats) await refreshProjectStats(context, projectId);

  if (!options.silent) {
    await recordAudit({
      action: existing ? "FILE_UPDATE" : "FILE_CREATE",
      actor: context.actor,
      projectId,
      targetType: "file",
      targetPath: path,
      targetId: row.id,
      correlationId: context.correlationId,
      severity: sensitivity.isSensitive ? "notice" : "info",
      detail: { bytes: bytes.byteLength, sensitive: sensitivity.isSensitive },
    });

    if (sensitivity.isSensitive) {
      await recordAudit({
        action: "SENSITIVE_FILE_DETECTED",
        actor: context.actor,
        projectId,
        targetType: "file",
        targetPath: path,
        severity: "warning",
        correlationId: context.correlationId,
        detail: { reason: sensitivity.reason ?? "filename policy" },
      });
    }
  }

  return toVaultNode(row);
}

/* ------------------------------------------------------------------ *
 * Public operations
 * ------------------------------------------------------------------ */

export async function createFile(
  context: VaultContext,
  projectId: string,
  path: string,
  content = "",
): Promise<VaultNode> {
  await authorizeProject(context, projectId, "file.create");
  const normalized = normalizePath(path);

  if (await getNodeByPath(context, projectId, normalized)) {
    throw new VaultError(`"${normalized}" already exists.`, "conflict");
  }

  return writeFileBytes(context, projectId, normalized, encoder.encode(content));
}

export async function updateFile(
  context: VaultContext,
  projectId: string,
  path: string,
  content: string,
): Promise<VaultNode> {
  await authorizeProject(context, projectId, "file.update");
  const normalized = normalizePath(path);
  const existing = await getNodeByPath(context, projectId, normalized);

  if (!existing) throw new VaultError("That file no longer exists.", "not_found");
  if (existing.type !== "file") throw validationError("That path is a folder.");

  return writeFileBytes(context, projectId, normalized, encoder.encode(content));
}

export async function createFolder(
  context: VaultContext,
  projectId: string,
  path: string,
): Promise<VaultNode> {
  await authorizeProject(context, projectId, "folder.create");
  const normalized = normalizePath(path);

  if (await getNodeByPath(context, projectId, normalized)) {
    throw new VaultError(`"${normalized}" already exists.`, "conflict");
  }

  const totals = await projectTotals(context, projectId);
  if (totals.nodeCount >= VAULT_LIMITS.maxNodesPerProject) {
    throw new VaultError("This project has reached its file and folder limit.", "limit");
  }

  await ensureFolderChain(context, projectId, normalized);
  const row = await getNodeByPath(context, projectId, normalized);
  if (!row) throw new VaultError("Could not create that folder.", "storage");

  await refreshProjectStats(context, projectId);
  await recordAudit({
    action: "FOLDER_CREATE",
    actor: context.actor,
    projectId,
    targetType: "folder",
    targetPath: normalized,
    targetId: row.id,
    correlationId: context.correlationId,
  });

  return toVaultNode(row);
}

async function descendantsOf(
  context: VaultContext,
  projectId: string,
  folderPath: string,
): Promise<NodeRow[]> {
  const { data, error } = await context.db
    .from("project_nodes")
    .select("*")
    .eq("project_id", projectId)
    .like("path", `${folderPath}/%`)
    .limit(VAULT_LIMITS.maxNodesPerProject);

  if (error) throw new VaultError("Could not read that folder's contents.", "storage");
  return data ?? [];
}

/** Rewrites a node's own path and every descendant path in one pass. */
async function repath(
  context: VaultContext,
  projectId: string,
  node: NodeRow,
  newPath: string,
  newParentId: string | null,
): Promise<void> {
  if (await getNodeByPath(context, projectId, newPath)) {
    throw new VaultError(`"${newPath}" already exists.`, "conflict");
  }

  const moves: { id: string; path: string }[] = [];

  if (node.type === "folder") {
    for (const child of await descendantsOf(context, projectId, node.path)) {
      moves.push({ id: child.id, path: `${newPath}${child.path.slice(node.path.length)}` });
    }
  }

  for (const move of moves) {
    if (pathDepth(move.path) > VAULT_LIMITS.maxDepth) {
      throw new VaultError("That move would nest files too deeply.", "limit", { path: move.path });
    }
  }

  const { error } = await context.db
    .from("project_nodes")
    .update({ name: pathName(newPath), path: newPath, depth: pathDepth(newPath), parent_id: newParentId })
    .eq("id", node.id);

  if (error) throw new VaultError("Could not move that item.", "storage");

  for (const move of moves) {
    const { error: childError } = await context.db
      .from("project_nodes")
      .update({ path: move.path, depth: pathDepth(move.path) })
      .eq("id", move.id);
    if (childError) throw new VaultError("Could not move that folder's contents.", "storage");
  }
}

export async function renameNode(
  context: VaultContext,
  projectId: string,
  nodeId: string,
  newName: string,
): Promise<VaultNode> {
  const node = await requireNode(context, projectId, nodeId);
  await authorizeProject(context, projectId, node.type === "file" ? "file.update" : "folder.rename");

  const name = assertValidName(newName);
  if (name === node.name) return toVaultNode(node);

  const parent = pathParent(node.path);
  const newPath = parent ? `${parent}/${name}` : name;

  await repath(context, projectId, node, newPath, node.parent_id);

  await recordAudit({
    action: node.type === "file" ? "FILE_RENAME" : "FOLDER_RENAME",
    actor: context.actor,
    projectId,
    targetType: node.type,
    targetPath: newPath,
    targetId: node.id,
    correlationId: context.correlationId,
    detail: { from: node.path, to: newPath },
  });

  const updated = await requireNode(context, projectId, nodeId);
  return toVaultNode(updated);
}

export async function moveNode(
  context: VaultContext,
  projectId: string,
  nodeId: string,
  destinationFolderPath: string | null,
): Promise<VaultNode> {
  const node = await requireNode(context, projectId, nodeId);
  await authorizeProject(context, projectId, node.type === "file" ? "file.update" : "folder.move");

  const destination = destinationFolderPath ? normalizePath(destinationFolderPath) : null;

  if (destination) {
    const target = await getNodeByPath(context, projectId, destination);
    if (!target) throw new VaultError("That destination folder does not exist.", "not_found");
    if (target.type !== "folder") throw validationError("The destination must be a folder.");
    if (node.type === "folder" && isWithin(node.path, destination)) {
      throw validationError("A folder cannot be moved inside itself.");
    }
  }

  const newPath = destination ? `${destination}/${node.name}` : node.name;
  if (newPath === node.path) return toVaultNode(node);

  const parentId = destination
    ? ((await getNodeByPath(context, projectId, destination))?.id ?? null)
    : null;

  await repath(context, projectId, node, newPath, parentId);

  await recordAudit({
    action: node.type === "file" ? "FILE_MOVE" : "FOLDER_MOVE",
    actor: context.actor,
    projectId,
    targetType: node.type,
    targetPath: newPath,
    targetId: node.id,
    correlationId: context.correlationId,
    detail: { from: node.path, to: newPath },
  });

  return toVaultNode(await requireNode(context, projectId, nodeId));
}

export async function deleteNode(
  context: VaultContext,
  projectId: string,
  nodeId: string,
): Promise<{ removed: number }> {
  const node = await requireNode(context, projectId, nodeId);
  await authorizeProject(context, projectId, node.type === "file" ? "file.delete" : "folder.delete");

  const descendants = node.type === "folder" ? await descendantsOf(context, projectId, node.path) : [];

  const { error } = await context.db.from("project_nodes").delete().eq("id", node.id);
  if (error) throw new VaultError("Could not delete that item.", "storage");

  await refreshProjectStats(context, projectId);

  await recordAudit({
    action: node.type === "file" ? "FILE_DELETE" : "FOLDER_DELETE",
    actor: context.actor,
    projectId,
    targetType: node.type,
    targetPath: node.path,
    targetId: node.id,
    correlationId: context.correlationId,
    detail: { descendantsRemoved: descendants.length },
  });

  // Blobs are intentionally retained: snapshots reference them, and they
  // are content-addressed. They are purged when the project is deleted.
  return { removed: 1 + descendants.length };
}
