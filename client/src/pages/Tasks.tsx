import { useMemo, useState } from "react";
import { useTasks, useProjects } from "../lib/hooks";
import { useDebouncedValue } from "../lib/debounce";
import { Topbar } from "../components/layout/Shell";
import { TaskRow } from "../features/tasks/TaskRow";
import { EmptyState, Skeleton, Button, ViewToggle } from "../components/ui/primitives";
import { useViewMode } from "../lib/viewMode";
import { useUI } from "../store/ui";
import { cn } from "../lib/cn";

const tabs = ["Toutes", "À faire", "En cours", "Terminées", "En retard"] as const;

const inputCls = "field-control field-sm";
const pillActive = "btn-press rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900";
const pillInactive = "btn-press rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";

export function Tasks() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Toutes");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [projectId, setProjectId] = useState("");
  const [tag, setTag] = useState("");
  const dq = useDebouncedValue(search);
  const dtag = useDebouncedValue(tag);
  const { data: tasks = [], isLoading } = useTasks({ search: dq || undefined, priority: priority || undefined, projectId: projectId || undefined, tags: dtag.trim() || undefined });
  const { data: projects = [] } = useProjects();
  const { setQuickAdd } = useUI();
  const [view, setView] = useViewMode("tasks", "list");
  const pname = (id?: string) => projects.find((p) => p._id === id)?.name;

  const filtered = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return tasks.filter((t) => {
      if (tab === "À faire" && t.status !== "todo") return false;
      if (tab === "En cours" && t.status !== "in_progress") return false;
      if (tab === "Terminées" && t.status !== "completed") return false;
      if (tab === "En retard" && !(t.dueDate && new Date(t.dueDate) < now && t.status !== "completed")) return false;
      return true;
    });
  }, [tasks, tab]);

  return (
    <div className="pb-24 md:pb-8">
      <Topbar title="Mes tâches" />
      <p className="kicker">01 — Filtres</p>
      <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Filtres statut">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn(tab === t ? pillActive : pillInactive)}>{t}</button>
        ))}
      </div>
      <div className="mb-4 mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input aria-label="Rechercher" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className={cn(inputCls, "w-full")} />
        <select aria-label="Filtrer par projet" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
          <option value="">Tous projets</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <select aria-label="Filtrer par priorité" value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
          <option value="">Toutes priorités</option><option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option>
        </select>
        <input aria-label="Filtrer par tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag…" className={cn(inputCls, "w-full")} />
      </div>
      <section aria-label="Liste des tâches">
        <div className="flex items-center justify-between gap-2">
          <p className="kicker">02 — Liste</p>
          {filtered.length > 0 && <ViewToggle mode={view} onChange={setView} />}
        </div>
        <h2 className="mt-1 text-lg font-bold tracking-tight">{tab} · {filtered.length}</h2>
        {isLoading ? <Skeleton className="mt-2.5 h-32" /> : filtered.length === 0 ? (
          <div className="mt-2.5"><EmptyState title="Vous n'avez encore aucune tâche." hint="Commencez par ajouter ce que vous souhaitez accomplir aujourd'hui." action={<Button onClick={() => setQuickAdd(true)}>Créer une tâche</Button>} /></div>
        ) : view === "list" ? (
          <div className="mt-2.5 space-y-2">{filtered.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>
        ) : (
          <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">{filtered.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>
        )}
      </section>
    </div>
  );
}
