import { useState } from "react";
import { Link } from "react-router-dom";
import { useProjects, useCreateProject, useTasks } from "../lib/hooks";
import { useWorkspace } from "../store/ui";
import { Topbar } from "../components/layout/Shell";
import { Card, EmptyState, Skeleton, Button } from "../components/ui/primitives";

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
    <div>
      <Topbar title="Projets" subtitle={`${projects.length} projet(s)`} />
      <Button onClick={() => setOpen(!open)}>+ Nouveau projet</Button>
      {open && (
        <Card className="mt-3">
          <div className="flex gap-2">
            <input aria-label="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du projet" className="w-full rounded-lg border px-3 py-2" />
            <Button onClick={submit} disabled={create.isPending || !activeWorkspaceId}>Créer</Button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={withFolder} onChange={(e) => setWithFolder(e.target.checked)} className="h-4 w-4 accent-blue-700" />
            Créer automatiquement un dossier pour ce projet
          </label>
        </Card>
      )}
      {!activeWorkspaceId && <p className="mt-3 text-sm text-amber-600">Sélectionnez un espace pour créer un projet.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <Skeleton className="h-28" /> : projects.map((p) => (
          <Link key={p._id} to={`/projects/${p._id}`}><Card>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: (p.color as string) ?? "#1d4ed8" }} /><span className="font-medium">{p.name}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800"><div className="progress-fill h-1.5 rounded-full" style={{ ["--w" as string]: `${p.progress ?? 0}%`, width: `${p.progress ?? 0}%` }} /></div>
            <p className="mt-1.5 text-xs text-stone-500">{p.completedTasks ?? 0}/{p.totalTasks ?? 0} tâches · <span className="font-black tabular-nums text-stone-900">{p.progress ?? 0}%</span></p>
          </Card></Link>
        ))}
      </div>
      {!isLoading && projects.length === 0 && <div className="mt-4"><EmptyState title="Aucun projet" hint="Créez votre premier projet pour organiser vos tâches." /></div>}
    </div>
  );
}

export function ProjectTasksCount({ projectId }: { projectId: string }) {
  const { data: tasks = [] } = useTasks({ projectId });
  return <span>{tasks.length}</span>;
}
