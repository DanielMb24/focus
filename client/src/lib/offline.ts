import { api, ApiError } from "./api";
import { queryClient } from "./queryClient";
import { notify } from "./notify";
import type { Task } from "../types";
import type { Note } from "../types";

export type MutationOp =
  | { kind: "task"; op: "create"; tempId: string; payload: Record<string, unknown> }
  | { kind: "task"; op: "update" | "toggle" | "move" | "delete"; id: string; payload?: Record<string, unknown> }
  | { kind: "note"; op: "create"; tempId: string; payload: Record<string, unknown> };

export interface OutboxEntry {
  id: string;
  op: MutationOp;
  createdAt: number;
  error?: string;
}

const DB = "focus-files";

function openOutbox(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ["pending-uploads", "offline-files", "sync-roots", "mutation-outbox"] as const) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function outboxAll(): Promise<OutboxEntry[]> {
  try {
    const db = await openOutbox();
    if (!db.objectStoreNames.contains("mutation-outbox")) { db.close(); return []; }
    return await new Promise<OutboxEntry[]>((resolve, reject) => {
      const tx = db.transaction("mutation-outbox", "readonly");
      const req = tx.objectStore("mutation-outbox").getAll();
      req.onsuccess = () => resolve((req.result as OutboxEntry[]).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

async function outboxPut(entry: OutboxEntry): Promise<void> {
  const db = await openOutbox();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("mutation-outbox", "readwrite");
    tx.objectStore("mutation-outbox").put(entry as unknown as Record<string, unknown>);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function outboxDelete(id: string): Promise<void> {
  try {
    const db = await openOutbox();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("mutation-outbox", "readwrite");
      tx.objectStore("mutation-outbox").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* ignore */ }
}

export function isTempId(id: string): boolean {
  return id.startsWith("local-");
}

function uid(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Replie une op sur un id temporaire dans la création en attente (pas de doublon). */
async function foldOrEnqueue(op: MutationOp): Promise<void> {
  const id = "tempId" in op ? op.tempId : op.id;
  if (isTempId(id) && op.op !== "create") {
    const all = await outboxAll();
    const create = all.find((e) => e.op.kind === "task" && e.op.op === "create" && e.op.tempId === id);
    if (create && create.op.op === "create") {
      if (op.op === "delete") {
        await outboxDelete(create.id);
        removeTaskFromCache(id);
        return;
      }
      if (op.op === "toggle") {
        const cur = (create.op.payload["status"] as string) ?? "todo";
        const next = cur === "completed" ? "todo" : "completed";
        create.op.payload["status"] = next;
        await outboxPut(create);
        patchTaskInCache(id, { status: next as Task["status"] });
        return;
      }
      if (op.op === "update" || op.op === "move") {
        Object.assign(create.op.payload, op.payload ?? {});
        if (op.op === "move" && op.payload?.["status"]) create.op.payload["status"] = op.payload["status"];
        await outboxPut(create);
        patchTaskInCache(id, (op.payload ?? {}) as Partial<Task>);
        return;
      }
    }
  }
  await outboxPut({ id: uid(), op, createdAt: Date.now() });
}

/* ---------- Mises à jour optimistes du cache (UI instantanée hors-ligne) ---------- */

function eachTaskList(fn: (list: Task[]) => Task[] | null): void {
  const cached = queryClient.getQueriesData<Task[] | { data: Task[] }>({ queryKey: ["tasks"] });
  for (const [key, data] of cached) {
    const list = Array.isArray(data) ? data : (data as { data?: Task[] })?.data;
    if (!Array.isArray(list)) continue;
    const next = fn(list);
    if (next) queryClient.setQueryData(key, Array.isArray(data) ? next : { ...(data as object), data: next });
  }
}

function patchTaskInCache(id: string, patch: Partial<Task>): void {
  eachTaskList((list) => (list.some((t) => t._id === id) ? list.map((t) => (t._id === id ? { ...t, ...patch } : t)) : null));
}

export function toggleTaskInCache(id: string): void {
  eachTaskList((list) => {
    const t = list.find((x) => x._id === id);
    if (!t) return null;
    const next = t.status === "completed" ? "todo" : "completed";
    return list.map((x) => (x._id === id ? { ...x, status: next } : x));
  });
}

function removeTaskFromCache(id: string): void {
  eachTaskList((list) => (list.some((t) => t._id === id) ? list.filter((t) => t._id !== id) : null));
}

function prependTaskToCache(task: Task): void {
  eachTaskList((list) => [{ ...task }, ...list]);
}

export const offlineCache = { patchTaskInCache, removeTaskFromCache, prependTaskToCache, toggleTaskInCache };

/** Ajout optimiste d'une note en cache (création hors-ligne). */
export function prependNoteToCache(note: Note): void {
  for (const [key, data] of queryClient.getQueriesData<Note[]>({ queryKey: ["notes"] })) {
    if (Array.isArray(data)) queryClient.setQueryData(key, [note, ...data]);
  }
}

/* ---------- Exécution ---------- */

async function executeOp(op: MutationOp): Promise<void> {
  switch (op.op) {
    case "create":
      if (op.kind === "task") {
        const created = await api<{ task: Task }>("/api/v1/tasks", { method: "POST", body: JSON.stringify(op.payload) });
        removeTaskFromCache(op.tempId);
        prependTaskToCache(created.task);
      } else {
        await api("/api/v1/notes", { method: "POST", body: JSON.stringify(op.payload) });
      }
      break;
    case "update":
      await api(`/api/v1/tasks/${op.id}`, { method: "PATCH", body: JSON.stringify(op.payload ?? {}) });
      break;
    case "toggle":
      await api(`/api/v1/tasks/${op.id}/complete`, { method: "PATCH", body: "{}" });
      break;
    case "move":
      await api(`/api/v1/tasks/${op.id}/move`, { method: "PATCH", body: JSON.stringify(op.payload ?? {}) });
      break;
    case "delete":
      await api(`/api/v1/tasks/${op.id}`, { method: "DELETE" });
      break;
  }
}

let flushing = false;

/** Rejoue la file dans l'ordre (au retour réseau + au démarrage). */
export async function flushOutbox(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const ops = await outboxAll();
    let done = 0;
    for (const entry of ops) {
      try {
        await executeOp(entry.op);
        await outboxDelete(entry.id);
        done++;
      } catch (e) {
        // Erreur métier (validation…) : on garde pour inspection, on continue le reste.
        if (!(e instanceof ApiError) || e.code !== "NETWORK") {
          await outboxPut({ ...entry, error: e instanceof Error ? e.message : "Échec" });
        }
        if (e instanceof ApiError && e.code === "NETWORK") break;
      }
    }
    if (done > 0) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      await notify("Synchronisation terminée", `${done} modification(s) envoyée(s).`, "info", "offline-flush");
    }
  } finally {
    flushing = false;
  }
}

export async function pendingOutboxCount(): Promise<number> {
  return (await outboxAll()).length;
}

/**
 * Exécute une mutation, ou la met en file locale si le réseau manque.
 * `applyOptimistic` met à jour l'UI immédiatement dans ce cas.
 */
export async function offlineFirst<T>(op: MutationOp, fn: () => Promise<T>, fallback: T, applyOptimistic?: () => void): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== "NETWORK") throw e;
    await foldOrEnqueue(op);
    applyOptimistic?.();
    void flushOutbox();
    return fallback;
  }
}

export function newTempTask(payload: Record<string, unknown>): Task {
  const now = new Date().toISOString();
  return {
    _id: uid(), workspaceId: String(payload["workspaceId"] ?? ""), projectId: undefined,
    title: String(payload["title"] ?? ""), description: (payload["description"] as string) ?? undefined,
    status: "todo", priority: (payload["priority"] as Task["priority"]) ?? "medium",
    dueDate: (payload["dueDate"] as string) ?? undefined, tags: [], subtasks: [],
    position: 0, createdAt: now, updatedAt: now,
  };
}
