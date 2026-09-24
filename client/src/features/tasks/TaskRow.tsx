import { useState } from "react";
import { Check, Pencil, CalendarClock } from "lucide-react";
import type { Task } from "../../types";
import { useToggleTask, useDeleteTask, useUpdateTask } from "../../lib/hooks";
import { Badge } from "../../components/ui/primitives";
import { cn } from "../../lib/cn";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TaskEdit } from "./TaskEdit";

const prio: Record<string, { label: string; dot: string; tone: "default" | "red" | "amber" | "green" | "blue" }> = {
  low: { label: "Basse", dot: "#a8a29e", tone: "default" },
  medium: { label: "Moyenne", dot: "#1d4ed8", tone: "green" },
  high: { label: "Haute", dot: "#b45309", tone: "amber" },
  urgent: { label: "Urgente", dot: "#b91c1c", tone: "red" },
};

export function TaskRow({ task, projectName }: { task: Task; projectName?: string }) {
  const toggle = useToggleTask();
  const del = useDeleteTask();
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const done = task.status === "completed";
  const subDone = (task.subtasks ?? []).filter((s) => s.completed).length;
  return (
    <div className="task-row group flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3.5 py-3 shadow-subtle dark:border-zinc-800 dark:bg-zinc-900">
      <button
        aria-label={done ? "Rouvrir la tâche" : "Terminer la tâche"}
        onClick={() => toggle.mutate(task._id)}
        className={cn(
          "task-check flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
          done ? "done border-stone-900 bg-stone-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-stone-300 hover:border-stone-600"
        )}
      >
        {done && <Check size={12} strokeWidth={3.5} />}
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={() => setEditing(true)} title="Modifier" className={cn("block w-full truncate text-left text-sm font-medium hover:underline", done && "text-stone-400 line-through")}>{task.title}</button>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-stone-500">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: prio[task.priority]?.dot }} />
          {projectName ? `${projectName} · ` : ""}
          {task.dueDate ? format(new Date(task.dueDate), "d MMM · HH:mm", { locale: fr }) : "Sans date"}
          {(task.subtasks ?? []).length > 0 ? ` · ${subDone}/${task.subtasks.length} sous-tâches` : ""}
          {task.estimatedDuration ? ` · ${task.estimatedDuration} min` : ""}
        </p>
      </div>
      <Badge tone={prio[task.priority]?.tone}>{prio[task.priority]?.label}</Badge>
      <button aria-label="Modifier" onClick={() => setEditing(true)} className="rounded-md p-1.5 text-stone-300 opacity-0 transition hover:bg-stone-100 hover:text-stone-700 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100"><Pencil size={13} /></button>
      {!done && task.status !== "cancelled" && (
        <button aria-label="Reporter à demain" title="Reporter à demain"
          onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); update.mutate({ id: task._id, dueDate: d.toISOString() }); }}
          className="rounded-md p-1.5 text-stone-300 opacity-0 transition hover:bg-stone-100 hover:text-stone-700 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          <CalendarClock size={14} />
        </button>
      )}
      <button aria-label="Supprimer" onClick={() => del.mutate(task._id)} className="rounded-md p-1.5 text-xs text-stone-300 opacity-0 transition hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100">✕</button>
      {editing && <TaskEdit task={task} onClose={() => setEditing(false)} />}
    </div>
  );
}
