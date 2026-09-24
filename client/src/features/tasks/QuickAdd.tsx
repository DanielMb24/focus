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

const inputCls = "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400";

export function QuickAdd() {
  const { quickAddOpen, setQuickAdd } = useUI();
  const { activeWorkspaceId } = useWorkspace();
  const { data: projects = [] } = useProjects(activeWorkspaceId);
  const { data: goals = [] } = useGoals();
  const create = useCreateTask();
  const [showMore, setShowMore] = useState(false);
  const [err, setErr] = useState("");
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
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
      <form onSubmit={handleSubmit(onSubmit)} onClick={(e) => e.stopPropagation()} className="animate-sheet-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black tracking-tight">Nouvelle tâche</h2>
            <button type="button" aria-label="Fermer" onClick={() => setQuickAdd(false)} className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"><X size={18} /></button>
          </div>
          <label className="mt-4 block text-sm font-medium">Titre
            <input {...register("title")} autoFocus placeholder="Ex. Réviser le chapitre 4" className={inputCls} />
          </label>
          {errors.title && <p className="mt-1 text-xs font-medium text-red-700">{errors.title.message}</p>}
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
            <label className="text-sm font-medium">Priorité
              <select {...register("priority")} className={inputCls}>
                <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option>
              </select>
            </label>
            <label className="text-sm font-medium">Objectif
              <select {...register("goalId")} className={inputCls}>
                <option value="">Aucun</option>
                {goals.map((g) => <option key={g._id} value={g._id}>{g.title}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={() => setShowMore(!showMore)} aria-expanded={showMore} className="mt-3 flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900">
            Plus d'options <ChevronDown size={15} className={cn("transition", showMore && "rotate-180")} />
          </button>
          {showMore && (
            <div className="animate-fade-up mt-1 space-y-3">
              <label className="block text-sm font-medium">Description
                <textarea {...register("description")} rows={3} placeholder="Détails, liens, critères…" className={inputCls} />
              </label>
              <label className="block text-sm font-medium">Tags (séparés par des virgules)
                <input {...register("tags")} placeholder="Ex. maths, urgent" className={inputCls} />
              </label>
            </div>
          )}
          {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
          <div className="sticky bottom-0 -mx-5 mt-5 flex justify-end gap-2 border-t border-stone-200 bg-white px-5 py-3 sm:-mx-6 sm:px-6 dark:border-zinc-700 dark:bg-zinc-900">
            <Button type="button" variant="ghost" onClick={() => setQuickAdd(false)}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Création…" : "Créer la tâche"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

