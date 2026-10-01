import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useTasks, useProjects, useCreateTask } from "../lib/hooks";
import { Topbar } from "../components/layout/Shell";
import { TaskRow } from "../features/tasks/TaskRow";
import { EmptyState, Skeleton, Button } from "../components/ui/primitives";
import { useUI, useWorkspace } from "../store/ui";

function dayKey(d?: string) { if (!d) return ""; return new Date(d).toDateString(); }
const todayK = new Date().toDateString();

const inputCls = "field-control field-sm";

export function Today() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: projects = [] } = useProjects();
  const create = useCreateTask();
  const { setQuickAdd } = useUI();
  const { activeWorkspaceId } = useWorkspace();
  const [quickTitle, setQuickTitle] = useState("");
  const [quickErr, setQuickErr] = useState("");
  const pname = (id?: string) => projects.find((p) => p._id === id)?.name;

  async function quickAddToday() {
    setQuickErr("");
    if (!quickTitle.trim()) return;
    if (!activeWorkspaceId) { setQuickErr("Aucun espace actif."); return; }
    try {
      await create.mutateAsync({ workspaceId: activeWorkspaceId, title: quickTitle.trim(), dueDate: new Date().toISOString() });
      setQuickTitle("");
    } catch (e) { setQuickErr(e instanceof Error ? e.message : "Échec"); }
  }

  const { overdue, today, doneToday } = useMemo(() => {
    const overdue = tasks.filter((t) => t.dueDate && dayKey(t.dueDate) !== todayK && new Date(t.dueDate) < new Date() && t.status !== "completed" && t.status !== "cancelled");
    const today = tasks.filter((t) => dayKey(t.dueDate) === todayK && t.status !== "completed");
    const doneToday = tasks.filter((t) => t.status === "completed" && t.completedAt && dayKey(t.completedAt) === todayK);
    return { overdue, today, doneToday };
  }, [tasks]);

  if (isLoading) return <div className="pb-24 md:pb-8"><Topbar title="Aujourd'hui" /><Skeleton className="h-32" /></div>;
  return (
    <div className="pb-24 md:pb-8">
      <Topbar title="Aujourd'hui" subtitle={`${today.length} tâche(s) prévue(s)`} />
      <form onSubmit={(e) => { e.preventDefault(); void quickAddToday(); }} className="mb-5 flex gap-2">
        <input aria-label="Ajouter une tâche pour aujourd'hui" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Ajouter une tâche pour aujourd'hui… Entrée pour valider"
          className={`${inputCls} w-full`} />
        <Button type="submit" disabled={create.isPending} aria-label="Ajouter"><Plus size={17} /></Button>
      </form>
      {quickErr && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">{quickErr}</p>}
      {overdue.length > 0 && (
        <section className="mb-8" aria-label="En retard">
          <p className="kicker">01 — Retard</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">En retard · {overdue.length}</h2>
          <div className="mt-2.5 space-y-2">{overdue.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>
        </section>
      )}
      <section aria-label="Prévues">
        <p className="kicker">02 — Jour</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight">Prévues aujourd'hui</h2>
        {today.length === 0 ? <div className="mt-2.5"><EmptyState title="Journée claire" hint="Ajoutez vos priorités du jour." action={<Button onClick={() => setQuickAdd(true)}>Créer une tâche</Button>} /></div>
          : <div className="mt-2.5 space-y-2">{today.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>}
      </section>
      {doneToday.length > 0 && (
        <section className="mt-8" aria-label="Terminées">
          <p className="kicker">03 — Bilan</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">Terminées · {doneToday.length}</h2>
          <div className="mt-2.5 space-y-2 opacity-80">{doneToday.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>
        </section>
      )}
    </div>
  );
}
