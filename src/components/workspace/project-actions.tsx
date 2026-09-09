import { useState } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { deleteProject, renameProject, setProjectArchived } from "@/lib/vault.mutations";

type ProjectActionsProps = {
  projectId: string;
  name: string;
  status: "active" | "archived";
  onChanged: () => Promise<void>;
};

export function ProjectActions({ projectId, name, status, onChanged }: ProjectActionsProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setOpen(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the project.");
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    const next = window.prompt("Project name", name)?.trim();
    if (!next || next === name) return;
    await run(() => renameProject({ data: { projectId, name: next } }));
  }

  async function archive() {
    await run(() => setProjectArchived({ data: { projectId, archived: status === "active" } }));
  }

  async function remove() {
    const confirmed = window.confirm(`Delete “${name}” permanently? This removes the project, snapshots, and private stored content.`);
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      await deleteProject({ data: { projectId } });
      await navigate({ to: "/dashboard" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the project.");
      setBusy(false);
    }
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} disabled={busy} className="rounded-md p-2 text-muted-foreground hover:bg-surface-raised hover:text-foreground" title="Project actions" aria-expanded={open}>
      <MoreHorizontal className="size-4" />
    </button>
    {open && <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-md border border-border bg-surface-raised p-1 shadow-xl">
      <button type="button" onClick={rename} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-surface-sunken"><Pencil className="size-3.5" /> Rename project</button>
      <button type="button" onClick={archive} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-surface-sunken">{status === "active" ? <Archive className="size-3.5" /> : <ArchiveRestore className="size-3.5" />}{status === "active" ? "Archive project" : "Restore project"}</button>
      <button type="button" onClick={remove} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"><Trash2 className="size-3.5" /> Delete project</button>
      {error && <p className="border-t border-border px-3 py-2 text-[10px] text-destructive">{error}</p>}
    </div>}
  </div>;
}
