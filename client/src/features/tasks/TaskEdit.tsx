import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Task } from "../../types";
import { useUpdateTask, useProjects, useGoals } from "../../lib/hooks";
import { useWorkspace } from "../../store/ui";
import { Button } from "../../components/ui/primitives";
import { AttachFiles } from "../files/AttachFiles";

const schema = z.object({
  title: z.string().min(1, "Titre requis"),
  description: z.string().max(5000).optional(),
  projectId: z.string().optional(),
  goalId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "completed", "cancelled"]),
  estimatedDuration: z.string().optional(),
});
type Form = z.infer<typeof schema>;

const inputCls = "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400";

function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function TaskEdit({ task, onClose }: { task: Task; onClose: () => void }) {
  const update = useUpdateTask();
  const { activeWorkspaceId } = useWorkspace();
  const { data: projects = [] } = useProjects(activeWorkspaceId);
  const { data: goals = [] } = useGoals();
  const [err, setErr] = useState("");
  const [subtasks, setSubtasks] = useState<{ title: string; completed: boolean }[]>(
    (task.subtasks ?? []).map((s) => ({ title: s.title, completed: !!s.completed }))
  );
  const [newSub, setNewSub] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task.title,
      description: task.description ?? "",
      projectId: task.projectId ?? "",
      goalId: task.goalId ?? "",
      dueDate: toDateInput(task.dueDate),
      priority: task.priority,
      status: task.status,
      estimatedDuration: task.estimatedDuration ? String(task.estimatedDuration) : "",
    },
  });

  async function onSubmit(f: Form) {
    setErr("");
    try {
      await update.mutateAsync({
        id: task._id,
        title: f.title,
        description: f.description || undefined,
        projectId: f.projectId || null,
        goalId: f.goalId || null,
        dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : null,
        priority: f.priority,
        status: f.status,
        estimatedDuration: f.estimatedDuration && Number(f.estimatedDuration) > 0 ? Number(f.estimatedDuration) : null,
        subtasks,
      });
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Échec de la mise à jour"); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Modifier la tâche" className="animate-overlay fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} onClick={(e) => e.stopPropagation()} className="animate-sheet-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-stone-200 bg-white shadow-lift sm:rounded-2xl dark:border-zinc-700 dark:bg-zinc-900" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black tracking-tight">Modifier la tâche</h2>
            <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"><X size={18} /></button>
          </div>
          <label className="mt-4 block text-sm font-medium">Titre
            <input {...register("title")} className={inputCls} />
          </label>
          {errors.title && <p className="mt-1 text-xs font-medium text-red-700">{errors.title.message}</p>}
          <label className="mt-3 block text-sm font-medium">Description
            <textarea {...register("description")} rows={3} className={inputCls} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Statut
              <select {...register("status")} className={inputCls}>
                <option value="todo">À faire</option><option value="in_progress">En cours</option><option value="completed">Terminée</option><option value="cancelled">Annulée</option>
              </select>
            </label>
            <label className="text-sm font-medium">Priorité
              <select {...register("priority")} className={inputCls}>
                <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Projet
              <select {...register("projectId")} className={inputCls}>
                <option value="">Sans projet</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Échéance<input {...register("dueDate")} type="date" className={inputCls} /></label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Objectif
              <select {...register("goalId")} className={inputCls}>
                <option value="">Aucun</option>
                {goals.map((g) => <option key={g._id} value={g._id}>{g.title}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Durée estimée (min)<input {...register("estimatedDuration")} type="number" min={0} placeholder="Ex. 45" className={inputCls} /></label>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium">Sous-tâches ({subtasks.filter((s) => s.completed).length}/{subtasks.length})</p>
            <div className="mt-1.5 space-y-1.5">
              {subtasks.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5 dark:border-zinc-700">
                  <input type="checkbox" aria-label={`Sous-tâche ${s.title}`} checked={s.completed} onChange={() => setSubtasks(subtasks.map((x, j) => j === i ? { ...x, completed: !x.completed } : x))} className="h-4 w-4 accent-blue-700" />
                  <span className={s.completed ? "flex-1 truncate text-sm text-stone-400 line-through" : "flex-1 truncate text-sm"}>{s.title}</span>
                  <button type="button" aria-label="Retirer la sous-tâche" onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))} className="p-1 text-stone-400 hover:text-red-700"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input aria-label="Nouvelle sous-tâche" value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newSub.trim()) { e.preventDefault(); setSubtasks([...subtasks, { title: newSub.trim(), completed: false }]); setNewSub(""); } }} placeholder="Ajouter une sous-tâche…" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800" />
              <Button type="button" variant="outline" onClick={() => { if (newSub.trim()) { setSubtasks([...subtasks, { title: newSub.trim(), completed: false }]); setNewSub(""); } }}><Plus size={16} /></Button>
            </div>
          </div>

          {task.tags.length > 0 && <p className="mt-3 text-xs text-stone-500">Tags : {task.tags.join(", ")}</p>}
          <AttachFiles entityType="task" entityId={task._id} />
          {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
          <div className="sticky bottom-0 -mx-5 mt-5 flex justify-end gap-2 border-t border-stone-200 bg-white px-5 py-3 sm:-mx-6 sm:px-6 dark:border-zinc-700 dark:bg-zinc-900">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={update.isPending}>{update.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
