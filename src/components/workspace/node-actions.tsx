import { useState } from "react";
import { MoreHorizontal, Pencil, FolderInput, Trash2 } from "lucide-react";
import { deleteProjectNode, moveProjectNode, renameProjectNode } from "@/lib/vault.mutations";
import type { VaultNode } from "@/lib/server/files.server";

export function NodeActions({ node, projectId, folders, onChanged }: { node: VaultNode; projectId: string; folders: VaultNode[]; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try { await action(); setOpen(false); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update this item."); }
    finally { setBusy(false); }
  }

  async function rename() {
    const next = window.prompt("Name", node.name)?.trim();
    if (!next || next === node.name) return;
    await run(() => renameProjectNode({ data: { projectId, nodeId: node.id, newName: next } }));
  }

  async function move() {
    const choices = ["/ (project root)", ...folders.map((folder) => folder.path)].join("\n");
    const selected = window.prompt(`Move to destination folder. Available folders:\n${choices}`, node.parentId ? folders.find((folder) => folder.id === node.parentId)?.path ?? "" : "");
    if (selected === null) return;
    const destination = selected.trim() || null;
    await run(() => moveProjectNode({ data: { projectId, nodeId: node.id, destinationFolderPath: destination } }));
  }

  async function remove() {
    if (!window.confirm(`Delete “${node.path}”?${node.type === "folder" ? " All contents inside it will also be removed." : ""}`)) return;
    await run(() => deleteProjectNode({ data: { projectId, nodeId: node.id } }));
  }

  return <div className="relative shrink-0">
    <button type="button" onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }} disabled={busy} className="rounded p-1 text-muted-foreground/60 hover:bg-surface-raised hover:text-foreground" title="Item actions">
      <MoreHorizontal className="size-3.5" />
    </button>
    {open && <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-border bg-surface-raised p-1 shadow-xl">
      <button type="button" onClick={rename} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[11px] hover:bg-surface-sunken"><Pencil className="size-3" /> Rename</button>
      <button type="button" onClick={move} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[11px] hover:bg-surface-sunken"><FolderInput className="size-3" /> Move</button>
      <button type="button" onClick={remove} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[11px] text-destructive hover:bg-destructive/10"><Trash2 className="size-3" /> Delete</button>
      {error && <p className="border-t border-border px-2.5 py-1.5 text-[9px] text-destructive">{error}</p>}
    </div>}
  </div>;
}
