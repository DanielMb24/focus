import { useState } from "react";
import { Link } from "react-router-dom";
import { useProjects, useCreateProject, useTasks } from "../lib/hooks";
import { useWorkspace } from "../store/ui";
import { Topbar } from "../components/layout/Shell";
import { Card, EmptyState, Skeleton, Button } from "../components/ui/primitives";

const inputCls = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 dark:border-zinc-700 dark:bg-zinc-900";

export function Projects() {
  const { activeWorkspaceId } = useWorkspace();
  const { data: projects = [], isLoading } = useProjects(activeWorkspaceId);
  const create = useCreateProject();
  const [name, setName] = useState("");
  const [withFolder, setWithFolder] = useState(true);
  const [open, setOpen] = useState(false);

  async function submit() {
    if (!name.trim() || !activeWorkspaceId) return;
    await create.mutateAsync({ workspaceId: activeWorkspaceId, name: name.trim(), color: "#1d4ed8", createFolder: withFolder });
    setName(""); setOpen(false);
  }

  return (
    <div className="pb-24 md:pb-8">
      <Topbar title="Projets" subtitle={`${projects.length} projet(s)`} />
      <Button onClick={() => setOpen(!open)}>+ Nouveau projet</Button>
      {open && (
        <Card className="mt-4">
          <div className="flex gap-2">
            <input aria-label="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du projet" className={`${inputCls} w-full`} />
            <Button onClick={submit} disabled={create.isPending || !activeWorkspaceId}>Créer</Button>
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-sm text-stone-500 dark:text-zinc-400">
            <input type="checkbox" checked={withFolder} onChange={(e) => setWithFolder(e.target.checked)} className="h-4 w-4 accent-stone-900" />
            Créer automatiquement un dossier pour ce projet
          </label>
        </Card>
      )}
      {!activeWorkspaceId && <p className="mt-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">Sélectionnez un espace pour créer un projet.</p>}
      <section aria-label="Liste des projets">
        <p className="kicker mt-4">01 — Liste</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? <Skeleton className="h-28" /> : projects.map((p) => (
            <Link key={p._id} to={`/projects/${p._id}`}>
              <Card>
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: (p.color as string) ?? "#1d4ed8" }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{p.name}</span>
                      <span className="font-bold tabular-nums">{p.progress ?? 0}%</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800"><div className="progress-fill h-1 rounded-full" style={{ ["--w" as string]: `${p.progress ?? 0}%`, width: `${p.progress ?? 0}%` }} /></div>
                    <p className="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">{p.completedTasks ?? 0}/{p.totalTasks ?? 0} tâches</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
      {!isLoading && projects.length === 0 && <div className="mt-4"><EmptyState title="Aucun projet" hint="Créez votre premier projet pour organiser vos tâches." /></div>}
    </div>
  );
}

export function ProjectTasksCount({ projectId }: { projectId: string }) {
  const { data: tasks = [] } = useTasks({ projectId });
  return <span>{tasks.length}</span>;
}
