import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Goal } from "../../types";
import { Button } from "../../components/ui/primitives";
import { AttachFiles } from "../files/AttachFiles";

const schema = z.object({
  title: z.string().min(1, "Titre requis"),
  description: z.string().max(2000).optional(),
  targetDate: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]),
});
type Form = z.infer<typeof schema>;

const inputCls = "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400";

function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function GoalEdit({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: goal.title,
      description: goal.description ?? "",
      targetDate: toDateInput(goal.targetDate),
      status: (goal.status as "active" | "completed" | "archived") ?? "active",
    },
  });
  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => api(`/api/v1/goals/${goal._id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); onClose(); },
    onError: (e) => setErr(e instanceof Error ? e.message : "Échec"),
  });
  const del = useMutation({
    mutationFn: () => api(`/api/v1/goals/${goal._id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["tasks"] }); onClose(); },
    onError: (e) => setErr(e instanceof Error ? e.message : "Échec"),
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="Modifier l'objectif" className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit((f) => save.mutate({ title: f.title, description: f.description || undefined, targetDate: f.targetDate || undefined, status: f.status }))} onClick={(e) => e.stopPropagation()} className="animate-sheet-up w-full max-w-lg rounded-2xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black tracking-tight">Modifier l'objectif</h2>
            <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100"><X size={18} /></button>
          </div>
          <label className="mt-4 block text-sm font-medium">Titre<input {...register("title")} className={inputCls} /></label>
          {errors.title && <p className="mt-1 text-xs font-medium text-red-700">{errors.title.message}</p>}
          <label className="mt-3 block text-sm font-medium">Description<textarea {...register("description")} rows={2} className={inputCls} /></label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Date cible<input {...register("targetDate")} type="date" className={inputCls} /></label>
            <label className="text-sm font-medium">Statut
              <select {...register("status")} className={inputCls}>
                <option value="active">Actif</option><option value="completed">Terminé</option><option value="archived">Archivé</option>
              </select>
            </label>
          </div>
          {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
          <AttachFiles entityType="goal" entityId={goal._id} />
          <div className="mt-5 flex items-center justify-between">
            <Button type="button" variant="danger" onClick={() => { if (window.confirm("Supprimer cet objectif ?")) del.mutate(); }}>Supprimer</Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "…" : "Enregistrer"}</Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

