import { useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMe, useTasks, useProjects, useCreateTask } from "../lib/hooks";
import { useRecentFiles } from "../lib/files";
import { Topbar } from "../components/layout/Shell";
import { Card, EmptyState, Skeleton, Button } from "../components/ui/primitives";
import { TaskRow } from "../features/tasks/TaskRow";
import { useUI, useWorkspace } from "../store/ui";
import { Link } from "react-router-dom";
import type { ProfileType } from "../types";

const SUGGESTIONS: Record<ProfileType, { title: string; priority: "low" | "medium" | "high" }[]> = {
  student: [
    { title: "Réviser le chapitre en cours", priority: "high" },
    { title: "Préparer le prochain devoir", priority: "medium" },
    { title: "Planifier les révisions de la semaine", priority: "medium" },
  ],
  professional: [
    { title: "Préparer la réunion de demain", priority: "high" },
    { title: "Envoyer le rapport hebdo", priority: "medium" },
    { title: "Faire le point sur les deadlines", priority: "medium" },
  ],
  entrepreneur: [
    { title: "Définir l'objectif du mois", priority: "high" },
    { title: "Avancer la roadmap produit", priority: "medium" },
    { title: "Préparer le point équipe", priority: "medium" },
  ],
};

function isToday(d?: string) {
  if (!d) return false;
  const t = new Date(d); const n = new Date();
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
}
function isOverdue(d?: string, status?: string) {
  if (!d || status === "completed" || status === "cancelled") return false;
  const t = new Date(d); const n = new Date(); n.setHours(0, 0, 0, 0);
  return t < n;
}

export function Dashboard() {
  const { data: me } = useMe();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: projects = [] } = useProjects();
  const { data: recentFiles = [] } = useRecentFiles();
  const { setQuickAdd } = useUI();
  const { activeWorkspaceId } = useWorkspace();
  const createTask = useCreateTask();
  const showSuggestions = tasks.length < 5 && !!me?.profileType;

  const stats = useMemo(() => {
    const today = tasks.filter((t) => isToday(t.dueDate) && t.status !== "completed");
    const done = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
    const active = tasks.filter((t) => t.status !== "cancelled");
    const rate = active.length ? Math.round((done / active.length) * 100) : 0;
    return { today: today.length, done, overdue, rate };
  }, [tasks]);

  const todayTasks = useMemo(() => {
    const prioW: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return tasks.filter((t) => isToday(t.dueDate) || isOverdue(t.dueDate, t.status)).sort((a, b) => (prioW[a.priority] - prioW[b.priority]) || String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 6);
  }, [tasks]);

  const urgent = useMemo(() => tasks.filter((t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "completed").slice(0, 4), [tasks]);
  const pname = (id?: string) => projects.find((p) => p._id === id)?.name;

  return (
    <div>
      <Topbar title={`Bonjour ${me?.firstName ?? ""}`} subtitle={format(new Date(), "EEEE d MMMM", { locale: fr })} />

      {/* 01 — Chiffres du jour, bandeau sobre avec filets */}
      <section aria-label="Chiffres du jour">
        <p className="kicker">01 — Aperçu</p>
        <dl className="mt-2 grid grid-cols-2 divide-stone-200 rounded-xl border border-stone-200 bg-white max-sm:gap-px sm:grid-cols-4 sm:divide-x dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {[
            { l: "Aujourd'hui", v: String(stats.today) },
            { l: "Terminées", v: String(stats.done) },
            { l: "En retard", v: String(stats.overdue) },
            { l: "Progression", v: `${stats.rate}%` },
          ].map((s) => (
            <div key={s.l} className="px-4 py-3.5">
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">{s.l}</dt>
              <dd className="font-display mt-0.5 text-[28px] font-bold tabular-nums leading-none tracking-tight">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
        {showSuggestions && (
          <section aria-label="Suggestions" className="lg:col-span-2">
            <p className="kicker">Suggestion</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">Par où commencer</h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {SUGGESTIONS[me?.profileType ?? "student"].map((s) => (
                <button
                  key={s.title}
                  disabled={!activeWorkspaceId || createTask.isPending}
                  onClick={() => activeWorkspaceId && createTask.mutate({ workspaceId: activeWorkspaceId, title: s.title, priority: s.priority })}
                  className="btn-press rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-stone-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  + {s.title}
                </button>
              ))}
            </div>
          </section>
        )}
        <section aria-label="Tâches du jour">
          <p className="kicker">02 — Jour</p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight">Aujourd'hui</h2>
            <Link to="/today" className="text-sm font-medium text-stone-500 hover:text-stone-900">Tout voir →</Link>
          </div>
          {isLoading ? <Skeleton className="mt-2.5 h-24" /> : todayTasks.length === 0 ? (
            <div className="mt-2.5"><EmptyState title="Rien d'urgent aujourd'hui" hint="Ajoutez ce que vous souhaitez accomplir." action={<Button onClick={() => setQuickAdd(true)}>Créer une tâche</Button>} /></div>
          ) : (<div className="mt-2.5 space-y-2">{todayTasks.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>)}
        </section>
        <div className="space-y-8">
          <section aria-label="Projets récents">
            <p className="kicker">03 — Projets</p>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">Projets récents</h2>
              <Link to="/projects" className="text-sm font-medium text-stone-500 hover:text-stone-900">Tout voir →</Link>
            </div>
            <div className="mt-2.5 space-y-2.5">{projects.slice(0, 3).map((p) => (
              <Link key={p._id} to={`/projects/${p._id}`}><Card><div className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-semibold">{p.name}</span><span className="font-bold tabular-nums">{p.progress ?? 0}%</span></div>
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800"><div className="progress-fill h-1 rounded-full" style={{ ["--w" as string]: `${p.progress ?? 0}%`, width: `${p.progress ?? 0}%` }} /></div></Card></Link>
            ))}{projects.length === 0 && <EmptyState title="Aucun projet" hint="Organisez vos tâches par projet." action={<Link to="/projects"><Button>Créer un projet</Button></Link>} />}</div>
          </section>
          <section aria-label="Priorités">
            <p className="kicker">04 — Signal faible</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">Priorités</h2>
            <div className="mt-2.5 space-y-2">{urgent.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}{urgent.length === 0 && <p className="text-sm text-stone-500">Aucune tâche urgente. Belle avance.</p>}</div>
          </section>
          {recentFiles.length > 0 && (
            <section aria-label="Fichiers récents">
              <p className="kicker">05 — Documents</p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold tracking-tight">Fichiers récents</h2>
                <Link to="/files" className="text-sm font-medium text-stone-500 hover:text-stone-900">Voir tout →</Link>
              </div>
              <ul className="mt-2.5 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {recentFiles.slice(0, 3).map((f) => (
                  <li key={f._id}>
                    <Link to={`/files/${f._id}`} className="block px-4 py-3 transition hover:bg-stone-50 dark:hover:bg-zinc-800/60">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-stone-400">{f.mimeType} · {(f.size / 1024).toFixed(0)} Ko</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
