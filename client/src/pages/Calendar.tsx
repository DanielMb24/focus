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

const inputCls = "field-control field-sm";
const pillActive = "btn-press rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900";
const pillInactive = "btn-press rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";

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
    <div className="pb-24 md:pb-8">
      <Topbar title="Calendrier" subtitle={format(cursor, "MMMM yyyy", { locale: fr })} />
      <p className="kicker">01 — Mois</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Mois précédent" className={pillInactive}>‹</button>
        <button onClick={() => { setCursor(new Date()); setSelected(new Date()); }} className={pillActive}>Aujourd'hui</button>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Mois suivant" className={pillInactive}>›</button>
      </div>
      <Card className="mt-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-widest text-stone-400">{["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const st = dayState(d);
            return (
              <button key={d.toISOString()} onClick={() => setSelected(d)} aria-label={format(d, "d MMMM", { locale: fr })}
                className={cn("flex h-11 flex-col items-center justify-center rounded-lg text-sm font-medium transition", isSameDay(d, selected) ? "bg-stone-900 font-semibold text-white dark:bg-white dark:text-zinc-900" : isSameDay(d, new Date()) ? "bg-stone-100 font-semibold text-stone-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-stone-900 hover:bg-stone-100 dark:text-zinc-100 dark:hover:bg-zinc-800")}>
                {format(d, "d")}{st !== "none" && <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", isSameDay(d, selected) ? "bg-white dark:bg-zinc-900" : st === "overdue" ? "bg-red-500" : "bg-stone-400")} />}
              </button>
            );
          })}
        </div>
      </Card>
      <section aria-label="Tâches du jour sélectionné" className="mt-8">
        <p className="kicker">02 — Jour sélectionné</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight">{format(selected, "EEEE d MMMM", { locale: fr })} · {dayTasks.length}</h2>
        <form onSubmit={(e) => { e.preventDefault(); void quickAddDay(); }} className="mb-3 mt-2.5 flex gap-2">
          <input aria-label={`Ajouter une tâche le ${format(selected, "d MMMM", { locale: fr })}`} value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)}
            placeholder={`+ Tâche le ${format(selected, "d MMM", { locale: fr })}…`}
            className={cn(inputCls, "w-full")} />
          <Button type="submit" disabled={create.isPending} aria-label="Ajouter"><Plus size={17} /></Button>
        </form>
        {quickErr && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">{quickErr}</p>}
        <div className="space-y-2">{dayTasks.map((t) => <TaskRow key={t._id} task={t} />)}{dayTasks.length === 0 && <p className="px-1 text-sm text-stone-500 dark:text-zinc-400">Aucune tâche ce jour.</p>}</div>
        <p className="mt-4 flex items-center gap-3 px-1 text-xs font-medium text-stone-500"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-stone-400" /> Tâches</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> En retard</span></p>
      </section>
    </div>
  );
}
