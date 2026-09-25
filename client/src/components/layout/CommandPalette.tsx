import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, FolderKanban, CheckSquare, FileText, StickyNote, Target } from "lucide-react";
import { api } from "../../lib/api";
import { useWorkspace } from "../../store/ui";
import { useDebouncedValue } from "../../lib/debounce";
import { useTask } from "../../lib/hooks";
import { TaskEdit } from "../../features/tasks/TaskEdit";

interface SearchResult {
  tasks: { _id: string; title: string; status: string }[];
  projects: { _id: string; name: string }[];
  files: { _id: string; name: string }[];
  notes: { _id: string; title: string }[];
  goals: { _id: string; title: string }[];
}

type Row =
  | { kind: "task"; id: string; label: string; sub: string }
  | { kind: "project" | "file" | "note" | "goal"; id: string; label: string; sub: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const { activeWorkspaceId } = useWorkspace();
  const nav = useNavigate();
  const dq = useDebouncedValue(q, 250);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); setQ(""); setIndex(0); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // UN seul appel (tâches + projets + fichiers + notes + objectifs).
  const { data } = useQuery({
    queryKey: ["palette-search", activeWorkspaceId, dq.trim()],
    queryFn: () =>
      api<SearchResult>(`/api/v1/search?workspaceId=${activeWorkspaceId}&q=${encodeURIComponent(dq.trim())}`),
    enabled: open && dq.trim().length >= 2 && !!activeWorkspaceId,
    staleTime: 15_000,
  });

  const results = useMemo<Row[]>(() => {
    if (!data) return [];
    return [
      ...data.tasks.map((t): Row => ({ kind: "task", id: t._id, label: t.title, sub: t.status })),
      ...data.projects.map((p): Row => ({ kind: "project", id: p._id, label: p.name, sub: "projet" })),
      ...data.files.map((f): Row => ({ kind: "file", id: f._id, label: f.name, sub: "fichier" })),
      ...data.notes.map((n): Row => ({ kind: "note", id: n._id, label: n.title, sub: "note" })),
      ...data.goals.map((g): Row => ({ kind: "goal", id: g._id, label: g.title, sub: "objectif" })),
    ];
  }, [data]);

  useEffect(() => setIndex(0), [q]);

  function choose(i: number) {
    const r = results[i];
    if (!r) return;
    setOpen(false); setQ("");
    if (r.kind === "project") nav(`/projects/${r.id}`);
    else if (r.kind === "file") nav(`/files/${r.id}`);
    else if (r.kind === "note") nav("/notes");
    else if (r.kind === "goal") nav("/goals");
    else setEditingTaskId(r.id);
  }

  if (!open) return null;

  const icons = { task: CheckSquare, project: FolderKanban, file: FileText, note: StickyNote, goal: Target };

  return (
    <div role="dialog" aria-modal="true" aria-label="Recherche rapide" className="animate-overlay fixed inset-0 z-50 flex items-start justify-center bg-stone-950/50 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="animate-pop w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-stone-200 px-4 dark:border-zinc-700">
          <Search size={17} className="text-stone-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIndex((v) => Math.min(v + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIndex((v) => Math.max(v - 1, 0)); }
              if (e.key === "Enter") choose(index);
            }}
            placeholder="Rechercher tâches, projets, fichiers… (min. 2 lettres)" aria-label="Rechercher"
            className="w-full bg-transparent py-3.5 text-sm outline-none" />
          <kbd className="rounded border border-stone-200 px-1.5 py-0.5 text-[11px] text-stone-400">Ctrl K</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {results.map((r, i) => {
            const Icon = icons[r.kind];
            return (
              <button key={`${r.kind}-${r.id}`} onClick={() => choose(i)} onMouseEnter={() => setIndex(i)}
                className={i === index ? "flex w-full items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 text-left dark:bg-zinc-800" : "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-zinc-800"}>
                <Icon size={16} className="shrink-0 text-stone-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.label}</span>
                <span className="text-xs text-stone-400">{r.sub}</span>
              </button>
            );
          })}
          {dq.trim().length >= 2 && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone-500">Aucun résultat.</p>}
          {dq.trim().length < 2 && <p className="px-3 py-6 text-center text-sm text-stone-500">Tapez pour rechercher partout.</p>}
        </div>
      </div>
      {editingTaskId && <TaskEditModal id={editingTaskId} onClose={() => setEditingTaskId(null)} />}
    </div>
  );
}

function TaskEditModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: task } = useTask(id);
  if (!task) return null;
  return <TaskEdit task={task} onClose={onClose} />;
}
