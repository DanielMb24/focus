import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Check, Pencil, CalendarClock, Trash2 } from "lucide-react";
import { useTask, useProjects, useGoals, useToggleTask, useDeleteTask, useUpdateTask } from "../lib/hooks";
import { Topbar } from "../components/layout/Shell";
import { Card, Button, Skeleton, Badge } from "../components/ui/primitives";
import { TaskEdit } from "../features/tasks/TaskEdit";
import { AttachFiles } from "../features/files/AttachFiles";
import { cn } from "../lib/cn";

const STATUS_LABEL: Record<string, string> = { todo: "À faire", in_progress: "En cours", completed: "Terminée", cancelled: "Annulée" };

export function TaskDetail() {
  const { taskId } = useParams();
  const nav = useNavigate();
  const { data: task, isLoading, isError } = useTask(taskId);
  const { data: projects = [] } = useProjects();
  const { data: goals = [] } = useGoals();
  const toggle = useToggleTask();
  const del = useDeleteTask();
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);

  if (isLoading) return <div><Topbar title="Tâche" /><Skeleton className="h-64" /></div>;
  if (isError || !task) {
    return (
      <div>
        <Topbar title="Tâche introuvable" />
        <Button variant="outline" onClick={() => nav("/tasks")}><ArrowLeft size={15} /> Retour aux tâches</Button>
      </div>
    );
  }

  const done = task.status === "completed";
  const project = projects.find((p) => p._id === task.projectId);
  const goal = goals.find((g) => g._id === task.goalId);
  const subDone = (task.subtasks ?? []).filter((s) => s.completed).length;
  const current: typeof task = task;

  async function toggleSub(i: number) {
    const subs = (current.subtasks ?? []).map((s, j) => (j === i ? { title: s.title, completed: !s.completed } : { title: s.title, completed: s.completed }));
    await update.mutateAsync({ id: current._id, subtasks: subs });
  }

  async function remove() {
    if (!window.confirm("Supprimer cette tâche ?")) return;
    await del.mutateAsync(current._id);
    nav("/tasks");
  }

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-2 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900">
        <ArrowLeft size={15} /> Retour
      </button>
      <Topbar title={task.title} subtitle={`${STATUS_LABEL[task.status] ?? task.status} · Priorité ${task.priority}`} />

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => toggle.mutate(task._id)} variant={done ? "outline" : "primary"}>
                <Check size={15} /> {done ? "Rouvrir" : "Terminer"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={15} /> Modifier</Button>
              {!done && (
                <Button variant="outline" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); update.mutate({ id: task._id, dueDate: d.toISOString() }); }}>
                  <CalendarClock size={15} /> Demain
                </Button>
              )}
              <Button variant="danger" onClick={() => void remove()}><Trash2 size={15} /> Supprimer</Button>
            </div>
            {task.description && <p className="mt-3 whitespace-pre-wrap break-all text-sm text-stone-600 dark:text-zinc-300">{task.description}</p>}
            {(task.subtasks ?? []).length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-bold">Sous-tâches ({subDone}/{task.subtasks.length})</p>
                <div className="mt-1.5 space-y-1.5">
                  {task.subtasks.map((s, i) => (
                    <label key={i} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-zinc-700">
                      <input type="checkbox" checked={s.completed} onChange={() => void toggleSub(i)} className="h-4 w-4 accent-blue-700" />
                      <span className={cn("flex-1", s.completed && "text-stone-400 line-through")}>{s.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Card>
            <AttachFiles entityType="task" entityId={task._id} />
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="font-black tracking-tight">Détails</h2>
            <dl className="mt-2 space-y-2 text-sm">
              <div><dt className="text-xs text-stone-400">Statut</dt><dd><Badge tone={done ? "green" : "default"}>{STATUS_LABEL[task.status]}</Badge></dd></div>
              <div><dt className="text-xs text-stone-400">Priorité</dt><dd className="font-medium capitalize">{task.priority}</dd></div>
              <div><dt className="text-xs text-stone-400">Échéance</dt><dd className="font-medium">{task.dueDate ? format(new Date(task.dueDate), "EEEE d MMMM · HH:mm", { locale: fr }) : "Sans date"}</dd></div>
              {task.estimatedDuration ? <div><dt className="text-xs text-stone-400">Durée estimée</dt><dd className="font-medium">{task.estimatedDuration} min</dd></div> : null}
              {task.tags.length > 0 && <div><dt className="text-xs text-stone-400">Tags</dt><dd className="flex flex-wrap gap-1">{task.tags.map((t) => <Badge key={t}>{t}</Badge>)}</dd></div>}
              <div><dt className="text-xs text-stone-400">Projet</dt><dd>{project ? <Link to={`/projects/${project._id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">{String(project.name)}</Link> : "Sans projet"}</dd></div>
              <div><dt className="text-xs text-stone-400">Objectif</dt><dd>{goal ? <Link to="/goals" className="font-medium text-blue-700 hover:underline dark:text-blue-400">{goal.title}</Link> : "Aucun"}</dd></div>
              <div><dt className="text-xs text-stone-400">Créée le</dt><dd className="text-stone-500">{new Date(task.createdAt).toLocaleString("fr-FR")}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
      {editing && <TaskEdit task={task} onClose={() => setEditing(false)} />}
    </div>
  );
}
