import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, StickyNote, X } from "lucide-react";
import { useNotes } from "../../lib/hooks";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/primitives";
import type { Note } from "../../types";

/** Notes liées à une tâche : lier l'existant, créer une note liée, détacher. */
export function TaskNotes({ taskId, workspaceId }: { taskId: string; workspaceId: string }) {
  const qc = useQueryClient();
  const { data: linked = [], isLoading } = useNotes(undefined, 100, taskId);
  const { data: all = [] } = useNotes(undefined, 100);
  const [linkId, setLinkId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"idle" | "link" | "create">("idle");

  const candidates = all.filter((n) => String(n.taskId ?? "") !== taskId);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["notes"] });
  }

  async function doLink() {
    if (!linkId) return;
    setBusy(true);
    try {
      await api(`/api/v1/notes/${linkId}`, { method: "PATCH", body: JSON.stringify({ taskId }) });
      setLinkId("");
      setMode("idle");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function doCreate() {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      await api("/api/v1/notes", {
        method: "POST",
        body: JSON.stringify({ workspaceId, title: newTitle.trim(), content: "", taskId }),
      });
      setNewTitle("");
      setMode("idle");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unlink(n: Note) {
    await api(`/api/v1/notes/${n._id}`, { method: "PATCH", body: JSON.stringify({ taskId: null }) });
    await refresh();
  }

  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <StickyNote size={15} className="text-stone-400" />
        Notes liées ({linked.length})
      </h3>
      <div className="mt-2.5 space-y-2">
        {isLoading && <p className="text-sm text-stone-400">Chargement…</p>}
        {!isLoading && linked.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 px-3.5 py-3 text-sm text-stone-500 dark:border-zinc-700">
            Aucune note liée. Attachez le contexte, le compte-rendu, la check-list.
          </p>
        )}
        {linked.map((n) => (
          <div key={n._id} className="group flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
            <Link to={`/notes/${n._id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline" title="Ouvrir dans l'éditeur">
              {n.title}
            </Link>
            <button onClick={() => void unlink(n)} title="Détacher de la tâche"
              className="rounded-md p-1 text-stone-300 opacity-0 transition hover:bg-stone-100 hover:text-stone-700 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {mode === "idle" ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMode("link")} className="!py-2 text-sm"><Link2 size={14} /> Lier une note</Button>
          <Button variant="outline" onClick={() => setMode("create")} className="!py-2 text-sm"><Plus size={14} /> Nouvelle note liée</Button>
        </div>
      ) : mode === "link" ? (
        <div className="mt-2.5 flex gap-2">
          <select aria-label="Choisir une note à lier" value={linkId} onChange={(e) => setLinkId(e.target.value)} className="field-control field-sm w-full">
            <option value="">Choisir une note…</option>
            {candidates.map((n) => <option key={n._id} value={n._id}>{n.title}</option>)}
          </select>
          <Button onClick={() => void doLink()} disabled={!linkId || busy} className="shrink-0 !py-2 text-sm">Lier</Button>
          <Button variant="ghost" onClick={() => setMode("idle")} className="shrink-0 !py-2 text-sm">Annuler</Button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void doCreate(); }} className="mt-2.5 flex gap-2">
          <input aria-label="Titre de la note liée" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titre de la note…" className="field-control field-sm w-full" autoFocus />
          <Button type="submit" disabled={!newTitle.trim() || busy} className="shrink-0 !py-2 text-sm">Créer</Button>
          <Button type="button" variant="ghost" onClick={() => setMode("idle")} className="shrink-0 !py-2 text-sm">Annuler</Button>
        </form>
      )}
    </div>
  );
}
