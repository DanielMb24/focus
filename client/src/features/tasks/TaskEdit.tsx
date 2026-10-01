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
import { cn } from "../../lib/cn";

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

const inputCls = "field-control mt-1.5 w-full";

const PRIORITIES = [
  { v: "low", label: "Basse", dot: "#a8a29e" },
  { v: "medium", label: "Moyenne", dot: "#1d4ed8" },
  { v: "high", label: "Haute", dot: "#d97706" },
  { v: "urgent", label: "Urgente", dot: "#dc2626" },
] as const;

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
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
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
  const prio = watch("priority");

  return (
    <div role="dialog" aria-modal="true" aria-label="Modifier la tâche" className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} onClick={(e) => e.stopPropagation()} className="animate-sheet-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[20px] border border-stone-200 bg-white shadow-lift ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Modifier la tâche</h2>
              <p className="mt-0.5 text-[13px] text-stone-500">Titre, échéance, priorité et sous-tâches.</p>
            </div>
            <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-full border border-stone-200 p-2 text-stone-400 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-700 dark:border-zinc-700"><X size={16} /></button>
          </div>
          <label className="mt-5 block">
            <span className="field-label">Titre</span>
            <input {...register("title")} className={inputCls} />
          </label>
          {errors.title && <p className="mt-1.5 text-xs font-medium text-red-700">{errors.title.message}</p>}
          <label className="mt-4 block">
            <span className="field-label">Description</span>
            <textarea {...register("description")} rows={3} className={inputCls} />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Statut</span>
              <select {...register("status")} className={inputCls}>
                <option value="todo">À faire</option><option value="in_progress">En cours</option><option value="completed">Terminée</option><option value="cancelled">Annulée</option>
              </select>
            </label>
            <div>
              <span className="field-label" id="te-prio-label">Priorité</span>
              <div role="radiogroup" aria-labelledby="te-prio-label" className="mt-1.5 grid grid-cols-2 gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    role="radio"
                    aria-checked={prio === p.v}
                    onClick={() => setValue("priority", p.v, { shouldDirty: true })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-[10px] border px-2.5 py-2 text-[13px] font-semibold transition",
                      prio === p.v
                        ? "border-[#1d4ed8] bg-[#eef3ff] text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                        : "border-[#d4d9e2] bg-white text-stone-500 hover:border-[#b3bac7] hover:text-stone-800 dark:border-zinc-700 dark:bg-zinc-900"
                    )}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.dot }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Projet</span>
              <select {...register("projectId")} className={inputCls}>
                <option value="">Sans projet</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="field-label">Échéance</span><input {...register("dueDate")} type="date" className={inputCls} /></label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Objectif</span>
              <select {...register("goalId")} className={inputCls}>
                <option value="">Aucun</option>
                {goals.map((g) => <option key={g._id} value={g._id}>{g.title}</option>)}
              </select>
            </label>
            <label className="block"><span className="field-label">Durée estimée <span className="font-normal text-stone-400">(min)</span></span><input {...register("estimatedDuration")} type="number" min={0} placeholder="Ex. 45" className={inputCls} /></label>
          </div>

          <div className="mt-5">
            <p className="field-label">Sous-tâches <span className="font-normal text-stone-400">({subtasks.filter((s) => s.completed).length}/{subtasks.length})</span></p>
            <div className="mt-1.5 space-y-1.5">
              {subtasks.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                  <input type="checkbox" aria-label={`Sous-tâche ${s.title}`} checked={s.completed} onChange={() => setSubtasks(subtasks.map((x, j) => j === i ? { ...x, completed: !x.completed } : x))} className="field-check h-4 w-4" />
                  <span className={s.completed ? "flex-1 truncate text-sm text-stone-400 line-through" : "flex-1 truncate text-sm"}>{s.title}</span>
                  <button type="button" aria-label="Retirer la sous-tâche" onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))} className="rounded-md p-1 text-stone-400 transition hover:bg-red-50 hover:text-red-700"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input aria-label="Nouvelle sous-tâche" value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newSub.trim()) { e.preventDefault(); setSubtasks([...subtasks, { title: newSub.trim(), completed: false }]); setNewSub(""); } }} placeholder="Ajouter une sous-tâche…" className="field-control field-sm w-full" />
              <Button type="button" variant="outline" onClick={() => { if (newSub.trim()) { setSubtasks([...subtasks, { title: newSub.trim(), completed: false }]); setNewSub(""); } }} className="!h-[38px] !w-[42px] !px-0"><Plus size={16} /></Button>
            </div>
          </div>

          {task.tags.length > 0 && <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-stone-400">Tags : {task.tags.join(", ")}</p>}
          <AttachFiles entityType="task" entityId={task._id} />
          {err && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{err}</p>}
          <div className="sticky bottom-0 -mx-5 mt-5 flex items-center justify-end gap-2 border-t border-stone-200 bg-white/95 px-5 py-3.5 backdrop-blur sm:-mx-6 sm:px-6 dark:border-zinc-700 dark:bg-zinc-900">
            <Button type="button" variant="ghost" onClick={onClose} className="h-11 px-5">Annuler</Button>
            <Button type="submit" disabled={update.isPending} className="h-11 px-6 text-[15px]">{update.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

