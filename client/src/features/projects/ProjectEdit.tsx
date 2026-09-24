import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../../types";
import { useUpdateProject, useDeleteProject } from "../../lib/hooks";
import { Button } from "../../components/ui/primitives";
import { cn } from "../../lib/cn";

const schema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().max(2000).optional(),
  color: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});
type Form = z.infer<typeof schema>;

const inputCls = "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400";
const colors = ["#1d4ed8", "#047857", "#b45309", "#be123c", "#6d28d9", "#0e7490", "#1c1917"];

function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso as string);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function ProjectEdit({ project, onClose }: { project: Project; onClose: () => void }) {
  const update = useUpdateProject(project._id);
  const del = useDeleteProject();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project.name,
      description: (project.description as string) ?? "",
      color: (project.color as string) ?? "#1d4ed8",
      status: (project.status as "active" | "completed" | "archived") ?? "active",
      startDate: toDateInput(project.startDate as string | undefined),
      dueDate: toDateInput(project.dueDate as string | undefined),
    },
  });
  const color = watch("color");

  async function onSubmit(f: Form) {
    setErr("");
    try {
      await update.mutateAsync({
        name: f.name,
        description: f.description || undefined,
        color: f.color,
        status: f.status,
        startDate: f.startDate || undefined,
        dueDate: f.dueDate || undefined,
      });
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Échec de la mise à jour"); }
  }

  async function onDelete() {
    if (!window.confirm(`Supprimer le projet « ${project.name} » ? Ses tâches seront conservées sans projet.`)) return;
    await del.mutateAsync(project._id);
    nav("/projects");
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Modifier le projet" className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} onClick={(e) => e.stopPropagation()} className="animate-sheet-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black tracking-tight">Modifier le projet</h2>
            <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100"><X size={18} /></button>
          </div>
          <label className="mt-4 block text-sm font-medium">Nom<input {...register("name")} className={inputCls} /></label>
          {errors.name && <p className="mt-1 text-xs font-medium text-red-700">{errors.name.message}</p>}
          <label className="mt-3 block text-sm font-medium">Description<textarea {...register("description")} rows={2} className={inputCls} /></label>
          <div className="mt-3">
            <p className="text-sm font-medium">Couleur</p>
            <div className="mt-1.5 flex gap-2">
              {colors.map((c) => (
                <button key={c} type="button" aria-label={`Couleur ${c}`} onClick={() => setValue("color", c)} className={cn("h-8 w-8 rounded-full border-2 transition", color === c ? "scale-110 border-stone-900 dark:border-white" : "border-transparent")} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <label className="text-sm font-medium">Statut
              <select {...register("status")} className={inputCls}>
                <option value="active">Actif</option><option value="completed">Terminé</option><option value="archived">Archivé</option>
              </select>
            </label>
            <label className="text-sm font-medium">Début<input {...register("startDate")} type="date" className={inputCls} /></label>
            <label className="text-sm font-medium">Échéance<input {...register("dueDate")} type="date" className={inputCls} /></label>
          </div>
          {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
          <div className="mt-5 flex items-center justify-between">
            <Button type="button" variant="danger" onClick={onDelete} disabled={del.isPending}>Supprimer</Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={update.isPending}>{update.isPending ? "…" : "Enregistrer"}</Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

