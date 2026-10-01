import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, ChevronDown } from "lucide-react";
import { useUI, useWorkspace } from "../../store/ui";
import { useCreateTask, useProjects, useGoals } from "../../lib/hooks";
import { Button } from "../../components/ui/primitives";
import { cn } from "../../lib/cn";

const schema = z.object({
  title: z.string().min(1, "Titre requis"),
  projectId: z.string().optional(),
  goalId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  description: z.string().max(5000).optional(),
  tags: z.string().optional(),
});
type Form = z.infer<typeof schema>;

const inputCls = "field-control mt-1.5 w-full";

const PRIORITIES = [
  { v: "low", label: "Basse", dot: "#a8a29e" },
  { v: "medium", label: "Moyenne", dot: "#1d4ed8" },
  { v: "high", label: "Haute", dot: "#d97706" },
  { v: "urgent", label: "Urgente", dot: "#dc2626" },
] as const;

export function QuickAdd() {
  const { quickAddOpen, setQuickAdd } = useUI();
  const { activeWorkspaceId } = useWorkspace();
  const { data: projects = [] } = useProjects(activeWorkspaceId);
  const { data: goals = [] } = useGoals();
  const create = useCreateTask();
  const [showMore, setShowMore] = useState(false);
  const [err, setErr] = useState("");
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const prio = watch("priority");
  if (!quickAddOpen) return null;

  async function onSubmit(f: Form) {
    setErr("");
    if (!activeWorkspaceId) { setErr("Aucun espace actif. Créez un espace dans Paramètres."); return; }
    try {
      await create.mutateAsync({
        workspaceId: activeWorkspaceId,
        title: f.title,
        projectId: f.projectId || undefined,
        goalId: f.goalId || undefined,
        dueDate: f.dueDate || undefined,
        priority: f.priority,
        description: f.description || undefined,
        tags: f.tags ? f.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      reset(); setShowMore(false); setQuickAdd(false);
    } catch (e) { setErr(e instanceof Error ? e.message : "Échec de la création"); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Nouvelle tâche" className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4" onClick={() => setQuickAdd(false)}>
      <form onSubmit={handleSubmit(onSubmit)} onClick={(e) => e.stopPropagation()} className="animate-sheet-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[20px] border border-stone-200 bg-white shadow-lift ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Nouvelle tâche</h2>
              <p className="mt-0.5 text-[13px] text-stone-500">Elle apparaîtra dans Aujourd'hui et Mes tâches.</p>
            </div>
            <button type="button" aria-label="Fermer" onClick={() => setQuickAdd(false)} className="rounded-full border border-stone-200 p-2 text-stone-400 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-700 dark:border-zinc-700"><X size={16} /></button>
          </div>

          <label className="mt-5 block">
            <span className="field-label">Titre</span>
            <input {...register("title")} autoFocus placeholder="Ex. Réviser le chapitre 4" className={inputCls} aria-invalid={!!errors.title} />
          </label>
          {errors.title && <p className="mt-1.5 text-xs font-medium text-red-700">{errors.title.message}</p>}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Projet</span>
              <select {...register("projectId")} className={inputCls}>
                <option value="">Sans projet</option>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Échéance</span>
              <input {...register("dueDate")} type="date" className={inputCls} />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <span className="field-label" id="qa-prio-label">Priorité</span>
              <div role="radiogroup" aria-labelledby="qa-prio-label" className="mt-1.5 grid grid-cols-2 gap-1.5">
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
            <label className="block">
              <span className="field-label">Objectif</span>
              <select {...register("goalId")} className={inputCls}>
                <option value="">Aucun</option>
                {goals.map((g) => <option key={g._id} value={g._id}>{g.title}</option>)}
              </select>
            </label>
          </div>

          <button type="button" onClick={() => setShowMore(!showMore)} aria-expanded={showMore} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#c9cfdb] py-2.5 text-[13px] font-semibold text-stone-500 transition hover:border-[#1d4ed8] hover:text-[#1d4ed8]">
            Plus d'options <ChevronDown size={15} className={cn("transition", showMore && "rotate-180")} />
          </button>
          {showMore && (
            <div className="animate-fade-up mt-3 space-y-4 rounded-xl bg-stone-50 p-3.5 dark:bg-zinc-800/60">
              <label className="block">
                <span className="field-label">Description</span>
                <textarea {...register("description")} rows={3} placeholder="Détails, liens, critères…" className={inputCls} />
              </label>
              <label className="block">
                <span className="field-label">Tags <span className="font-normal text-stone-400">(séparés par des virgules)</span></span>
                <input {...register("tags")} placeholder="Ex. maths, urgent" className={inputCls} />
              </label>
            </div>
          )}
          {err && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{err}</p>}
          <div className="sticky bottom-0 -mx-5 mt-5 flex items-center justify-end gap-2 border-t border-stone-200 bg-white/95 px-5 py-3.5 backdrop-blur sm:-mx-6 sm:px-6 dark:border-zinc-700 dark:bg-zinc-900">
            <Button type="button" variant="ghost" onClick={() => setQuickAdd(false)} className="h-11 px-5">Annuler</Button>
            <Button type="submit" disabled={create.isPending} className="h-11 px-6 text-[15px]">{create.isPending ? "Création…" : "Créer la tâche"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
