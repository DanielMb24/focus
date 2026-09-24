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
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[{ l: "Aujourd'hui", v: stats.today }, { l: "Terminées", v: stats.done }, { l: "En retard", v: stats.overdue }, { l: "Progression", v: `${stats.rate}%` }].map((s) => (
          <Card key={s.l}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">{s.l}</p>
            <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">{s.v}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {showSuggestions && (
          <section aria-label="Suggestions" className="lg:col-span-2">
            <h2 className="mb-2 font-black tracking-tight">Suggestions pour vous</h2>
            <div className="stagger flex flex-wrap gap-2">
              {SUGGESTIONS[me?.profileType ?? "student"].map((s) => (
                <button
                  key={s.title}
                  disabled={!activeWorkspaceId || createTask.isPending}
                  onClick={() => activeWorkspaceId && createTask.mutate({ workspaceId: activeWorkspaceId, title: s.title, priority: s.priority })}
                  className="btn-press rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-blue-700 hover:text-blue-800 disabled:opacity-50"
                >
                  + {s.title}
                </button>
              ))}
            </div>
          </section>
        )}
        <section aria-label="Tâches du jour">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Aujourd'hui</h2><Link to="/today" className="text-sm text-blue-600">Tout voir</Link></div>
          {isLoading ? <Skeleton className="h-24" /> : todayTasks.length === 0 ? (
            <EmptyState title="Rien d'urgent aujourd'hui" hint="Ajoutez ce que vous souhaitez accomplir." action={<Button onClick={() => setQuickAdd(true)}>Créer une tâche</Button>} />
          ) : (<div className="stagger space-y-2">{todayTasks.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>)}
        </section>
        <div className="space-y-6">
          <section aria-label="Projets récents">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Projets récents</h2><Link to="/projects" className="text-sm text-blue-600">Tout voir</Link></div>
            <div className="stagger space-y-3">{projects.slice(0, 3).map((p) => (
              <Link key={p._id} to={`/projects/${p._id}`}><Card><div className="flex justify-between text-sm"><span className="font-bold">{p.name}</span><span className="font-black tabular-nums">{p.progress ?? 0}%</span></div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800"><div className="progress-fill h-1.5 rounded-full" style={{ ["--w" as string]: `${p.progress ?? 0}%`, width: `${p.progress ?? 0}%` }} /></div></Card></Link>
            ))}{projects.length === 0 && <EmptyState title="Aucun projet" hint="Organisez vos tâches par projet." action={<Link to="/projects"><Button>Créer un projet</Button></Link>} />}</div>
          </section>
          <section aria-label="Priorités">
            <h2 className="mb-2 font-semibold">Priorités</h2>
            <div className="stagger space-y-2">{urgent.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}{urgent.length === 0 && <p className="text-sm text-zinc-500">Aucune tâche urgente. Belle avance !</p>}</div>
          </section>
          {recentFiles.length > 0 && (
            <section aria-label="Fichiers récents">
              <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Fichiers récents</h2><Link to="/files" className="text-sm text-blue-700">Voir tout</Link></div>
              <div className="space-y-2">
                {recentFiles.slice(0, 3).map((f) => (
                  <Link key={f._id} to={`/files/${f._id}`}>
                    <Card><p className="truncate text-sm font-medium">📄 {f.name}</p>
                      <p className="text-xs text-stone-500">{f.mimeType} · {(f.size / 1024).toFixed(0)} Ko</p></Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}


