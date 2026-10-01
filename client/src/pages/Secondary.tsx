import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Copy, FileDown, FilePlus2, FileText, Printer, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useGoals, useNotes, useFocusSessions, useTasks } from "../lib/hooks";
import { useWorkspace } from "../store/ui";
import { Topbar } from "../components/layout/Shell";
import { Card, EmptyState, Button, Skeleton } from "../components/ui/primitives";
import { offlineFirst, prependNoteToCache } from "../lib/offline";
import { GoalEdit } from "../features/goals/GoalEdit";
import { notify } from "../lib/notify";
import { cn } from "../lib/cn";
import { docToHtml, docToMarkdown, docToText, downloadBlob, parseNoteContent, slugFilename } from "../lib/noteDoc";
import { exportNoteDocx, printNote } from "../lib/noteExport";
import { noteStats } from "../lib/noteAssist";
import type { Note } from "../types";

const inputCls = "field-control field-sm";
const miniBtn = "shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";
const pillActive = "rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900";
const pillInactive = "rounded-full bg-stone-100 px-4 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";

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
    <div className="pb-24 md:pb-8"><Topbar title="Objectifs" subtitle="Cap sur l'essentiel" />
      <Button onClick={() => setOpen(!open)}>+ Nouvel objectif</Button>
      {open && <Card className="mt-3"><div className="flex gap-2"><input aria-label="Titre objectif" value={title} onChange={(e) => setTitle(e.target.value)} className={cn(inputCls, "w-full")} placeholder="Ex. Valider le semestre" /><Button onClick={() => { if (title.trim()) { create.mutate(title.trim()); setTitle(""); setOpen(false); } }} disabled={!activeWorkspaceId}>Créer</Button></div></Card>}
      <section aria-label="Liste des objectifs">
        <p className="kicker mt-4">01 — Liste</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">{isLoading ? <Skeleton className="h-24" /> : goals.map((g) => {
          return (
            <Card key={g._id}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 truncate font-semibold"><span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-stone-300 dark:bg-zinc-600" aria-hidden />{g.title}</p>
                <button onClick={() => setEditingGoal(g._id)} className={miniBtn}>Modifier</button>
              </div>
              {g.description && <p className="mt-0.5 line-clamp-2 text-sm text-stone-500 dark:text-zinc-400">{g.description}</p>}
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800"><div className="progress-fill h-1 rounded-full" style={{ ["--w" as string]: `${g.progress}%`, width: `${g.progress}%` }} /></div>
              <p className="mt-1.5 text-xs text-stone-500 dark:text-zinc-400">{g.progress}% · {g.completedTasks ?? 0}/{g.totalTasks ?? 0} tâches · {g.status}{g.targetDate ? ` · cible : ${new Date(g.targetDate).toLocaleDateString("fr-FR")}` : ""}</p>
            </Card>
          );
        })}
        </div>
      </section>
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
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const create = useMutation({
    mutationFn: async (t: string) => {
      const payload = { workspaceId: activeWorkspaceId, title: t, content: "" };
      const temp = { _id: `local-${Date.now()}`, workspaceId: activeWorkspaceId as string, title: t, content: "", updatedAt: new Date().toISOString() };
      return offlineFirst(
        { kind: "note", op: "create", tempId: temp._id, payload },
        () => api("/api/v1/notes", { method: "POST", body: JSON.stringify(payload) }),
        {},
        () => prependNoteToCache(temp)
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/v1/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  async function newDocument() {
    setErr("");
    if (!activeWorkspaceId) { setErr("Aucun espace actif."); return; }
    setBusy(true);
    try {
      const d = await api<{ note: Note }>("/api/v1/notes", {
        method: "POST",
        body: JSON.stringify({ workspaceId: activeWorkspaceId, title: title.trim() || "Sans titre", content: "" }),
      });
      qc.invalidateQueries({ queryKey: ["notes"] });
      nav(`/notes/${d.note._id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Création impossible hors-ligne — utilisez la capture rapide ci-dessus.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(n: Note) {
    setMenuId(null);
    try {
      const d = await api<{ note: Note }>("/api/v1/notes", {
        method: "POST",
        body: JSON.stringify({ workspaceId: n.workspaceId, title: `${n.title} (copie)`, content: n.content ?? "" }),
      });
      qc.invalidateQueries({ queryKey: ["notes"] });
      nav(`/notes/${d.note._id}`);
    } catch { /* erreur réseau */ }
  }

  async function exportCard(n: Note, kind: "docx" | "pdf" | "md") {
    setMenuId(null);
    const doc = parseNoteContent(n.content);
    if (kind === "docx") await exportNoteDocx(n.title, doc, slugFilename(n.title, "docx"));
    else if (kind === "md") downloadBlob(new Blob([`# ${n.title}\n\n${docToMarkdown(doc)}\n`], { type: "text/markdown" }), slugFilename(n.title, "md"));
    else printNote(n.title, docToHtml(doc), `Exporté de Focus le ${new Date().toLocaleDateString("fr-FR")}`);
  }

  return (
    <div className="pb-24 md:pb-8"><Topbar title="Notes" subtitle={`${notes.length} note${notes.length > 1 ? "s" : ""} · documents & idées`} />
      <Card>
        <form
          onSubmit={(e) => { e.preventDefault(); if (title.trim()) { create.mutate(title.trim()); setTitle(""); } }}
          className="flex gap-2"
        >
          <input aria-label="Nouvelle note" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Capture rapide : écrivez une idée…" className="field-control w-full text-[15px]" />
          <Button type="submit" disabled={!activeWorkspaceId || !title.trim()} className="h-11 shrink-0 !rounded-xl !px-5">Ajouter</Button>
        </form>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input aria-label="Rechercher notes" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher dans vos notes…" className="field-control field-sm min-w-40 flex-1" />
          <Button variant="outline" onClick={() => void newDocument()} disabled={busy || !activeWorkspaceId} className="!py-2 text-sm">
            <FilePlus2 size={15} /> Nouveau document
          </Button>
        </div>
        {err && <p role="alert" className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{err}</p>}
      </Card>
      <section aria-label="Liste des notes">
        <div className="mt-5 flex items-baseline justify-between">
          <p className="kicker">01 — Documents</p>
          {notes.length > 0 && <p className="font-mono text-[11px] uppercase tracking-wide text-stone-400">{notes.length} note{notes.length > 1 ? "s" : ""}</p>}
        </div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">{isLoading ? <Skeleton className="h-28" /> : notes.map((n) => {
          const preview = docToText(parseNoteContent(n.content)).slice(0, 160);
          const words = noteStats(docToText(parseNoteContent(n.content))).words;
          return (
            <Card key={n._id} className="card-lift group">
              <button onClick={() => nav(`/notes/${n._id}`)} className="block w-full text-left" title="Ouvrir dans l'éditeur">
                <p className="truncate text-[16px] font-bold tracking-tight">{n.title}</p>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-stone-500 dark:text-zinc-300">{preview || "Document vide — cliquez pour écrire."}</p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-stone-400">
                  {new Date(n.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {words} mots
                </p>
              </button>
              <div className="mt-3 flex items-center gap-1.5 border-t border-stone-100 pt-2.5 dark:border-zinc-800">
                <button onClick={() => nav(`/notes/${n._id}`)} className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-stone-700 dark:bg-white dark:text-zinc-900">Ouvrir</button>
                <div className="relative ml-auto">
                  <button aria-label={`Actions pour ${n.title}`} aria-expanded={menuId === n._id} onClick={() => setMenuId(menuId === n._id ? null : n._id)}
                    className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-stone-400 transition hover:bg-stone-100 hover:text-stone-900">⋯</button>
                  {menuId === n._id && (
                    <div role="menu" className="animate-pop absolute bottom-full right-0 z-30 mb-1.5 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
                      <button role="menuitem" onClick={() => void duplicate(n)} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition hover:bg-stone-50 dark:hover:bg-zinc-800"><Copy size={14} className="text-stone-400" /> Dupliquer</button>
                      <button role="menuitem" onClick={() => void exportCard(n, "docx")} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition hover:bg-stone-50 dark:hover:bg-zinc-800"><FileDown size={14} className="text-stone-400" /> Exporter Word</button>
                      <button role="menuitem" onClick={() => void exportCard(n, "pdf")} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition hover:bg-stone-50 dark:hover:bg-zinc-800"><Printer size={14} className="text-stone-400" /> Exporter PDF</button>
                      <button role="menuitem" onClick={() => void exportCard(n, "md")} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition hover:bg-stone-50 dark:hover:bg-zinc-800"><FileText size={14} className="text-stone-400" /> Exporter Markdown</button>
                      <button role="menuitem" onClick={() => { setMenuId(null); if (window.confirm(`Supprimer « ${n.title} » ?`)) del.mutate(n._id); }} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"><Trash2 size={14} /> Supprimer</button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        </div>
      </section>
      {!isLoading && notes.length === 0 && <div className="mt-4"><EmptyState title="Votre première note vous attend" hint="Capture rapide ci-dessus, ou document complet avec assistant et exports." action={<Button onClick={() => void newDocument()}>Créer un document</Button>} /></div>}
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
      if (rem <= 0) { clearInterval(iv); void notify("Session Focus terminée", `${Math.round(planned / 60)} min de concentration.`); void stop(d.session._id); return; }
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
    <div className="pb-24 md:pb-8"><Topbar title="Focus" subtitle={data ? `${Math.round((data.todayStats.totalSec ?? 0) / 60)} min aujourd'hui · ${data.todayStats.count ?? 0} session(s)` : "Concentration maximale"} />
      <section aria-label="Minuteur">
        <p className="kicker">01 — Minuteur</p>
        <Card className="mx-auto mt-2 max-w-md">
          <label className="block text-left text-sm font-medium">Tâche (optionnel)
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={cn(inputCls, "mt-1 w-full")}><option value="">—</option>{tasks.filter((t) => t.status !== "completed").slice(0, 30).map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}</select>
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{presets.map((p) => <button key={p.l} onClick={() => setPlanned(p.s)} className={planned === p.s ? pillActive : pillInactive}>{p.l}</button>)}
            <label className="flex items-center gap-1.5 text-sm font-medium text-stone-500">Perso <input aria-label="Durée personnalisée (minutes)" value={custom} onChange={(e) => { setCustom(e.target.value); const n = Number(e.target.value); if (n > 0) setPlanned(Math.min(480, n) * 60); }} type="number" min={1} max={480} className="field-control field-sm !w-[72px] text-center" /> min</label>
          </div>
          <p className="mx-auto mt-5 flex h-44 w-44 items-center justify-center rounded-full border border-stone-300 text-4xl font-bold tabular-nums tracking-tight dark:border-zinc-700">{mm}</p>
          <p className="mt-2 text-center text-sm text-stone-500">{activeTask?.title ?? "Aucune tâche sélectionnée"}</p>
          <div className="mt-4 flex justify-center gap-2">
            {!sessionId ? <Button onClick={start}>Démarrer</Button> : (<><Button variant="outline" onClick={() => stop()}>Pause</Button><Button onClick={() => stop()}>Terminer</Button></>)}
          </div>
        </Card>
      </section>
      <section aria-label="Sessions récentes">
        <p className="kicker mt-8">02 — Historique</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight">Sessions récentes</h2>
        <div className="mt-2.5 space-y-2">{(data?.sessions ?? []).slice(0, 10).map((s) => (
          <Card key={s._id}><p className="text-sm font-semibold">{Math.round(s.durationSec / 60)} min / {Math.round(s.plannedSec / 60)} min {s.completed ? "· Terminée" : ""}</p>
            <p className="text-xs text-stone-500 dark:text-zinc-400">{new Date(s.startedAt).toLocaleString("fr-FR")}</p></Card>))}
        </div>
      </section>
    </div>
  );
}
