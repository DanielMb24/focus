import { useMemo, useState } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus } from "lucide-react";
import { useTasks, useCreateTask } from "../lib/hooks";
import { useWorkspace } from "../store/ui";
import { Topbar } from "../components/layout/Shell";
import { Card, Button } from "../components/ui/primitives";
import { TaskRow } from "../features/tasks/TaskRow";
import { cn } from "../lib/cn";

export function Calendar() {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const from = monthStart.toISOString();
  const to = monthEnd.toISOString();
  const { data: tasks = [] } = useTasks({ dueFrom: from, dueTo: to });
  const create = useCreateTask();
  const { activeWorkspaceId } = useWorkspace();
  const [quickTitle, setQuickTitle] = useState("");
  const [quickErr, setQuickErr] = useState("");

  const dayTasks = useMemo(() => tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), selected)), [tasks, selected]);
  const dayState = (d: Date): "none" | "tasks" | "overdue" => {
    const list = tasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), d) && t.status !== "completed" && t.status !== "cancelled");
    if (!list.length) return "none";
    return list.some((t) => new Date(t.dueDate as string) < startOfDay(new Date())) ? "overdue" : "tasks";
  };

  async function quickAddDay() {
    setQuickErr("");
    if (!quickTitle.trim()) return;
    if (!activeWorkspaceId) { setQuickErr("Aucun espace actif."); return; }
    try {
      const due = new Date(selected);
      due.setHours(12, 0, 0, 0);
      await create.mutateAsync({ workspaceId: activeWorkspaceId, title: quickTitle.trim(), dueDate: due.toISOString() });
      setQuickTitle("");
    } catch (e) { setQuickErr(e instanceof Error ? e.message : "Échec"); }
  }

  return (
    <div>
      <Topbar title="Calendrier" subtitle={format(cursor, "MMMM yyyy", { locale: fr })} />
      <div className="flex gap-2">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg border px-3 py-1 text-sm">‹</button>
        <button onClick={() => { setCursor(new Date()); setSelected(new Date()); }} className="rounded-lg border px-3 py-1 text-sm">Aujourd'hui</button>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg border px-3 py-1 text-sm">›</button>
      </div>
      <Card className="mt-3">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">{["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const st = dayState(d);
            return (
              <button key={d.toISOString()} onClick={() => setSelected(d)} aria-label={format(d, "d MMMM", { locale: fr })}
                className={cn("flex h-10 flex-col items-center justify-center rounded-lg text-sm transition", isSameDay(d, selected) ? "bg-blue-700 font-bold text-white" : isSameDay(d, new Date()) ? "bg-blue-50 font-bold text-blue-800" : "hover:bg-stone-100 dark:hover:bg-zinc-800")}>
                {format(d, "d")}{st !== "none" && <span className={cn("mt-0.5 h-1 w-1 rounded-full", isSameDay(d, selected) ? "bg-white" : st === "overdue" ? "bg-red-600" : "bg-blue-600")} />}
              </button>
            );
          })}
        </div>
      </Card>
      <h2 className="mb-2 mt-4 font-black tracking-tight">{format(selected, "EEEE d MMMM", { locale: fr })} ({dayTasks.length})</h2>
      <form onSubmit={(e) => { e.preventDefault(); void quickAddDay(); }} className="mb-3 flex gap-2">
        <input aria-label={`Ajouter une tâche le ${format(selected, "d MMMM", { locale: fr })}`} value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)}
          placeholder={`+ Tâche le ${format(selected, "d MMM", { locale: fr })}…`}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm shadow-subtle outline-none focus:border-blue-700 dark:border-zinc-700 dark:bg-zinc-900" />
        <Button type="submit" disabled={create.isPending} aria-label="Ajouter"><Plus size={17} /></Button>
      </form>
      {quickErr && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{quickErr}</p>}
      <div className="stagger space-y-2">{dayTasks.map((t) => <TaskRow key={t._id} task={t} />)}{dayTasks.length === 0 && <p className="text-sm text-stone-500">Aucune tâche ce jour.</p>}</div>
      <p className="mt-3 flex items-center gap-3 text-xs text-stone-400"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> Tâches</span><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-600" /> En retard</span></p>
    </div>
  );
}

