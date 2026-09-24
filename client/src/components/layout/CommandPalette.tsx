import { useWorkspace } from "../../store/ui";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, FolderKanban, CheckSquare, FileText } from "lucide-react";
import { api } from "../../lib/api";
import type { Task, Project } from "../../types";
import type { FileAsset } from "../../types.files";
import { TaskEdit } from "../../features/tasks/TaskEdit";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { activeWorkspaceId } = useWorkspace();
  const nav = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); setQ(""); setIndex(0); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: tasks = [] } = useQuery({
    queryKey: ["palette-tasks"],
    queryFn: () => api<{ data: Task[] } | Task[]>("/api/v1/tasks?limit=100").then((d) => (Array.isArray(d) ? d : d.data ?? [])),
    enabled: open,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["palette-projects"],
    queryFn: () => api<{ data: Project[] } | Project[]>("/api/v1/projects?limit=100").then((d) => (Array.isArray(d) ? d : d.data ?? [])),
    enabled: open,
  });
  const { data: paletteFiles = [] } = useQuery({
    queryKey: ["palette-files", activeWorkspaceId],
    queryFn: () => api<{ data: FileAsset[] } | FileAsset[]>(`/api/v1/files?workspaceId=${activeWorkspaceId}&limit=100`).then((d) => (Array.isArray(d) ? d : d.data ?? [])),
    enabled: open && !!activeWorkspaceId,
  });

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const mt = tasks.filter((t) => t.title.toLowerCase().includes(needle)).slice(0, 6).map((t) => ({ kind: "task" as const, id: t._id, label: t.title, sub: t.status, obj: t }));
    const mp = projects.filter((p) => String(p.name).toLowerCase().includes(needle)).slice(0, 3).map((p) => ({ kind: "project" as const, id: p._id, label: String(p.name), sub: "projet", obj: null as Task | null }));
    const mf = paletteFiles.filter((f) => f.name.toLowerCase().includes(needle)).slice(0, 4).map((f) => ({ kind: "file" as const, id: f._id, label: f.name, sub: "fichier", obj: null as Task | null }));
    return [...mt, ...mp, ...mf];
  }, [q, tasks, projects, paletteFiles]);

  useEffect(() => setIndex(0), [q]);

  function choose(i: number) {
    const r = results[i];
    if (!r) return;
    setOpen(false); setQ("");
    if (r.kind === "project") nav(`/projects/${r.id}`);
    else if (r.kind === "file") nav(`/files/${r.id}`);
    else if (r.obj) setEditingTask(r.obj);
  }

  if (!open) return (
    <>
      {editingTask && <TaskEdit task={editingTask} onClose={() => setEditingTask(null)} />}
    </>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Recherche rapide" className="animate-overlay fixed inset-0 z-50 flex items-start justify-center bg-stone-950/50 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="animate-pop w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-stone-200 px-4 dark:border-zinc-700">
          <Search size={17} className="text-stone-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter") choose(index);
            }}
            placeholder="Rechercher tâches, projets… (min. 2 lettres)" aria-label="Rechercher"
            className="w-full bg-transparent py-3.5 text-sm outline-none" />
          <kbd className="rounded border border-stone-200 px-1.5 py-0.5 text-[11px] text-stone-400">Ctrl K</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {results.map((r, i) => (
            <button key={`${r.kind}-${r.id}`} onClick={() => choose(i)} onMouseEnter={() => setIndex(i)}
              className={i === index ? "flex w-full items-center gap-3 rounded-lg bg-blue-50 px-3 py-2.5 text-left dark:bg-zinc-800" : "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-zinc-800"}>
              {r.kind === "task" ? <CheckSquare size={16} className="shrink-0 text-stone-400" /> : r.kind === "file" ? <FileText size={16} className="shrink-0 text-stone-400" /> : <FolderKanban size={16} className="shrink-0 text-stone-400" />}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.label}</span>
              <span className="text-xs text-stone-400">{r.sub}</span>
            </button>
          ))}
          {q.trim().length >= 2 && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone-500">Aucun résultat.</p>}
          {q.trim().length < 2 && <p className="px-3 py-6 text-center text-sm text-stone-500">Tapez pour rechercher parmi vos tâches et projets.</p>}
        </div>
      </div>
      {editingTask && <TaskEdit task={editingTask} onClose={() => setEditingTask(null)} />}
    </div>
  );
}
