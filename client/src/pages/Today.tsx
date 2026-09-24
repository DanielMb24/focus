import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useTasks, useProjects, useCreateTask } from "../lib/hooks";
import { Topbar } from "../components/layout/Shell";
import { TaskRow } from "../features/tasks/TaskRow";
import { EmptyState, Skeleton, Button } from "../components/ui/primitives";
import { useUI, useWorkspace } from "../store/ui";

function dayKey(d?: string) { if (!d) return ""; return new Date(d).toDateString(); }
const todayK = new Date().toDateString();

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

  if (isLoading) return <div><Topbar title="Aujourd'hui" /><Skeleton className="h-32" /></div>;
  return (
    <div>
      <Topbar title="Aujourd'hui" subtitle={`${today.length} tâche(s) prévue(s)`} />
      <form onSubmit={(e) => { e.preventDefault(); void quickAddToday(); }} className="mb-5 flex gap-2">
        <input aria-label="Ajouter une tâche pour aujourd'hui" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Ajouter une tâche pour aujourd'hui… Entrée pour valider"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm shadow-subtle outline-none focus:border-blue-700 dark:border-zinc-700 dark:bg-zinc-900" />
        <Button type="submit" disabled={create.isPending} aria-label="Ajouter"><Plus size={17} /></Button>
      </form>
      {quickErr && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{quickErr}</p>}
      {overdue.length > 0 && (
        <section className="mb-6" aria-label="En retard"><h2 className="mb-2 font-black tracking-tight text-red-700">En retard ({overdue.length})</h2>
          <div className="stagger space-y-2">{overdue.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>
        </section>
      )}
      <section aria-label="Prévues"><h2 className="mb-2 font-black tracking-tight">Prévues aujourd'hui</h2>
        {today.length === 0 ? <EmptyState title="Journée claire" hint="Ajoutez vos priorités du jour." action={<Button onClick={() => setQuickAdd(true)}>Créer une tâche</Button>} />
          : <div className="stagger space-y-2">{today.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>}
      </section>
      {doneToday.length > 0 && (
        <section className="mt-6" aria-label="Terminées"><h2 className="mb-2 font-black tracking-tight text-emerald-700">Terminées ({doneToday.length})</h2>
          <div className="space-y-2 opacity-80">{doneToday.map((t) => <TaskRow key={t._id} task={t} projectName={pname(t.projectId)} />)}</div>
        </section>
      )}
    </div>
  );
}
