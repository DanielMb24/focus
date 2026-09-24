import { useMemo, useState } from "react";
import { useTasks, useProjects } from "../lib/hooks";
import { Topbar } from "../components/layout/Shell";
import { TaskRow } from "../features/tasks/TaskRow";
import { EmptyState, Skeleton, Button } from "../components/ui/primitives";
import { useUI } from "../store/ui";

const tabs = ["Toutes", "À faire", "En cours", "Terminées", "En retard"] as const;

export function Tasks() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Toutes");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [projectId, setProjectId] = useState("");
  const [tag, setTag] = useState("");
  const { data: tasks = [], isLoading } = useTasks({ search: search || undefined, priority: priority || undefined, projectId: projectId || undefined, tags: tag.trim() || undefined });
  const { data: projects = [] } = useProjects();
  const { setQuickAdd } = useUI();
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
    <div>
      <Topbar title="Mes tâches" />
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Filtres statut">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? "rounded-full bg-blue-700 px-3.5 py-1.5 text-sm font-medium text-white" : "rounded-full bg-stone-200/60 px-3.5 py-1.5 text-sm text-stone-600 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300"}>{t}</button>
        ))}
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input aria-label="Rechercher" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-900" />
        <select aria-label="Filtrer par projet" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Tous projets</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <select aria-label="Filtrer par priorité" value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Toutes priorités</option><option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option>
        </select>
        <input aria-label="Filtrer par tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag…" className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-900" />
      </div>
      {isLoading ? <Skeleton className="h-32" /> : filtered.length === 0 ? (
        <EmptyState title="Vous n'avez encore aucune tâche." hint="Commencez par ajouter ce que vous souhaitez accomplir aujourd'hui." action={<Button onClick={() => setQuickAdd(true)}>Créer une tâche</Button>} />
      ) : <div className="stagger space-y-2">{filtered.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>}
    </div>
  );
}
