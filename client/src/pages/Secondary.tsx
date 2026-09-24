import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useGoals, useNotes, useFocusSessions, useTasks } from "../lib/hooks";
import { useWorkspace } from "../store/ui";
import { Topbar } from "../components/layout/Shell";
import { Card, EmptyState, Button, Skeleton } from "../components/ui/primitives";
import { GoalEdit } from "../features/goals/GoalEdit";
import { AttachFiles } from "../features/files/AttachFiles";
import { notify } from "../lib/notify";

// Goals
export function Goals() {
  const { data: goals = [], isLoading } = useGoals();
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (t: string) => api("/api/v1/goals", { method: "POST", body: JSON.stringify({ workspaceId: activeWorkspaceId, title: t }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
  return (
    <div><Topbar title="Objectifs" />
      <Button onClick={() => setOpen(!open)}>+ Nouvel objectif</Button>
      {open && <Card className="mt-3 flex gap-2"><input aria-label="Titre objectif" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Ex. Valider le semestre" /><Button onClick={() => { if (title.trim()) { create.mutate(title.trim()); setTitle(""); setOpen(false); } }} disabled={!activeWorkspaceId}>Créer</Button></Card>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">{isLoading ? <Skeleton className="h-24" /> : goals.map((g) => (
        <Card key={g._id}><div className="flex items-center justify-between gap-2"><p className="truncate font-bold">{g.title}</p>
            <button onClick={() => setEditingGoal(g._id)} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800">Modifier</button></div>
          {g.description && <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{g.description}</p>}
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="progress-fill h-1.5 rounded-full" style={{ ["--w" as string]: `${g.progress}%`, width: `${g.progress}%` }} /></div>
          <p className="mt-1.5 text-xs text-stone-500">{g.progress}% · {g.completedTasks ?? 0}/{g.totalTasks ?? 0} tâches · {g.status}{g.targetDate ? ` · cible : ${new Date(g.targetDate).toLocaleDateString("fr-FR")}` : ""}</p></Card>))}
      </div>
      {editingGoal && (() => { const g = goals.find((x) => x._id === editingGoal); return g ? <GoalEdit goal={g} onClose={() => setEditingGoal(null)} /> : null; })()}
      {!isLoading && goals.length === 0 && <div className="mt-4"><EmptyState title="Aucun objectif" hint="Définissez un cap et associez-y des tâches." /></div>}
    </div>
  );
}

// Notes
export function Notes() {
  const [search, setSearch] = useState("");
  const { data: notes = [], isLoading } = useNotes(search || undefined);
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const create = useMutation({
    mutationFn: (t: string) => api("/api/v1/notes", { method: "POST", body: JSON.stringify({ workspaceId: activeWorkspaceId, title: t, content: "" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
  const save = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api(`/api/v1/notes/${id}`, { method: "PATCH", body: JSON.stringify({ title: notes.find((n) => n._id === id)?.title ?? "", content }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); setEditingId(null); },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/v1/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
  return (
    <div><Topbar title="Notes" />
      <div className="flex gap-2"><input aria-label="Nouvelle note" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la note…" className="w-full rounded-lg border px-3 py-2" />
        <Button onClick={() => { if (title.trim()) { create.mutate(title.trim()); setTitle(""); } }} disabled={!activeWorkspaceId}>Ajouter</Button></div>
      <input aria-label="Rechercher notes" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" />
      <div className="mt-3 grid gap-3 md:grid-cols-2">{isLoading ? <Skeleton className="h-24" /> : notes.map((n) => (
        <Card key={n._id}>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate font-bold">{n.title}</p>
            <div className="flex shrink-0 gap-1">
              <button aria-label="Modifier la note" onClick={() => { setEditingId(n._id); setDraft(n.content ?? ""); }} className="rounded-md px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">Modifier</button>
              <button aria-label="Supprimer note" onClick={() => del.mutate(n._id)} className="rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-red-50 hover:text-red-700 dark:text-zinc-500 dark:hover:text-red-400">✕</button>
            </div>
          </div>
          {editingId === n._id ? (
            <div className="mt-2">
              <textarea aria-label="Contenu de la note" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} placeholder="Écrivez ici…" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800" />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditingId(null)}>Annuler</Button>
                <Button onClick={() => save.mutate({ id: n._id, content: draft })} disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
              </div>
              <AttachFiles entityType="note" entityId={n._id} />
            </div>
          ) : (
            <p className="mt-1 break-all whitespace-pre-wrap text-sm text-stone-600 dark:text-zinc-300">{n.content || "Note vide — cliquez sur Modifier."}</p>
          )}
        </Card>))}
      </div>
      {!isLoading && notes.length === 0 && <div className="mt-4"><EmptyState title="Aucune note" hint="Capturez rapidement une idée ou un compte-rendu." /></div>}
    </div>
  );
}

// Focus
const presets = [{ l: "25 min", s: 25 * 60 }, { l: "50 min", s: 50 * 60 }];
export function Focus() {
  const { data, refetch } = useFocusSessions();
  const { data: tasks = [] } = useTasks();
  const [taskId, setTaskId] = useState("");
  const [planned, setPlanned] = useState(25 * 60);
  const [custom, setCustom] = useState("25");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  async function start() {
    const d = await api<{ session: { _id: string } }>("/api/v1/focus/start", { method: "POST", body: JSON.stringify({ taskId: taskId || undefined, plannedSec: planned }) });
    setSessionId(d.session._id); setLeft(planned);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const el = Math.floor((Date.now() - t0) / 1000);
      const rem = planned - el;
      if (rem <= 0) { clearInterval(iv); void notify("Session Focus terminée", `${Math.round(planned / 60)} min de concentration — beau travail.`); void stop(d.session._id); return; }
      setLeft(rem);
    }, 1000);
    (window as unknown as { __focusIv?: number }).__focusIv = iv as unknown as number;
  }
  async function stop(id?: string) {
    const sid = id ?? sessionId;
    if (!sid) return;
    clearInterval((window as unknown as { __focusIv?: number }).__focusIv);
    await api(`/api/v1/focus/${sid}/stop`, { method: "POST", body: "{}" });
    setSessionId(null); setLeft(null); refetch();
  }
  const mm = left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "--:--";
  const activeTask = tasks.find((t) => t._id === taskId);

  return (
    <div><Topbar title="Focus" subtitle={data ? `${Math.round((data.todayStats.totalSec ?? 0) / 60)} min aujourd'hui · ${data.todayStats.count ?? 0} session(s)` : ""} />
      <Card className="mx-auto max-w-md text-center">
        <label className="block text-left text-sm font-medium">Tâche (optionnel)
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">—</option>{tasks.filter((t) => t.status !== "completed").slice(0, 30).map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}</select>
        </label>
        <div className="mt-3 flex justify-center gap-2">{presets.map((p) => <button key={p.l} onClick={() => setPlanned(p.s)} className={planned === p.s ? "rounded-full bg-blue-600 px-3 py-1 text-sm text-white" : "rounded-full bg-stone-200/60 px-3 py-1 text-sm text-stone-600 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300"}>{p.l}</button>)}
          <label className="flex items-center gap-1 text-sm">Perso <input aria-label="Durée personnalisée (minutes)" value={custom} onChange={(e) => { setCustom(e.target.value); const n = Number(e.target.value); if (n > 0) setPlanned(Math.min(480, n) * 60); }} type="number" min={1} max={480} className="w-16 rounded border px-2 py-1" /> min</label>
        </div>
        <p className="mx-auto mt-5 flex h-44 w-44 items-center justify-center rounded-full border-4 border-blue-700 bg-white text-4xl font-black tabular-nums tracking-tight shadow-subtle dark:border-blue-500 dark:bg-zinc-900">{mm}</p>
        <p className="mt-1 text-sm text-zinc-500">{activeTask?.title ?? "Aucune tâche sélectionnée"}</p>
        <div className="mt-4 flex justify-center gap-2">
          {!sessionId ? <Button onClick={start}>Démarrer</Button> : (<><Button variant="outline" onClick={() => stop()}>Pause</Button><Button onClick={() => stop()}>Terminer</Button></>)}
        </div>
      </Card>
      <h2 className="mb-2 mt-6 font-semibold">Sessions récentes</h2>
      <div className="space-y-2">{(data?.sessions ?? []).slice(0, 10).map((s) => (
        <Card key={s._id}><p className="text-sm">{Math.round(s.durationSec / 60)} min / {Math.round(s.plannedSec / 60)} min {s.completed ? "· Terminée" : ""}</p>
          <p className="text-xs text-zinc-500">{new Date(s.startedAt).toLocaleString("fr-FR")}</p></Card>))}
      </div>
    </div>
  );
}


