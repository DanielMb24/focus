import { queryClient } from "./queryClient";
import { notify } from "./notify";
import type { Task } from "../types";

const DAY_KEY = () => new Date().toISOString().slice(0, 10);

function allTasks(): Task[] {
  const seen = new Map<string, Task>();
  for (const [, data] of queryClient.getQueriesData<Task[] | { data: Task[] }>({ queryKey: ["tasks"] })) {
    const list = Array.isArray(data) ? data : (data as { data?: Task[] } | undefined)?.data;
    if (!Array.isArray(list)) continue;
    for (const t of list) if (t && !seen.has(t._id)) seen.set(t._id, t);
  }
  return [...seen.values()];
}

function isToday(d: Date): boolean {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function isTomorrow(d: Date): boolean {
  const n = new Date();
  n.setDate(n.getDate() + 1);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Bilan quotidien : retards + échéances du jour/demain. Une fois par jour max. */
export async function maybeSendDailyDigest(force = false): Promise<void> {
  try {
    const key = `digest-${DAY_KEY()}`;
    if (!force && localStorage.getItem(key)) return;
    const tasks = allTasks().filter((t) => t.status !== "completed" && t.status !== "cancelled");
    if (tasks.length === 0) return;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    let overdue = 0;
    let today = 0;
    let tomorrow = 0;
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      if (Number.isNaN(d.getTime())) continue;
      if (d < today0) overdue++;
      else if (isToday(d)) today++;
      else if (isTomorrow(d)) tomorrow++;
    }
    if (overdue + today + tomorrow === 0) return;
    const parts: string[] = [];
    if (overdue) parts.push(`${overdue} en retard`);
    if (today) parts.push(`${today} pour aujourd'hui`);
    if (tomorrow) parts.push(`${tomorrow} pour demain`);
    await notify("Votre journée en bref", parts.join(" · "), "tasks", key);
    localStorage.setItem(key, "1");
  } catch {
    /* digest best-effort */
  }
}
