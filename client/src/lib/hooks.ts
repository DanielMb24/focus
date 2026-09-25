import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { offlineFirst, offlineCache, newTempTask } from "./offline";
import type { Task, Project, Workspace, User, Goal, Note, FocusSession } from "../types";
import { useWorkspace } from "../store/ui";

// Auth
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<{ user: User }>("/api/v1/auth/me").then((d) => d.user), retry: false });
}

// Workspaces
export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api<{ workspaces: Workspace[] }>("/api/v1/workspaces").then((d) => d.workspaces),
  });
}
export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: string }) => api<{ workspace: Workspace }>("/api/v1/workspaces", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

// Projects
export function useProjects(workspaceId?: string | null) {
  return useQuery({
    queryKey: ["projects", workspaceId ?? "all"],
    queryFn: () =>
      api<{ data: Project[] } | Project[]>(`/api/v1/projects${workspaceId ? `?workspaceId=${workspaceId}` : ""}`).then((d) =>
        Array.isArray(d) ? d : ((d as unknown as { data: Project[] }).data ?? [])
      ),
    enabled: true,
  });
}
export function useProject(id?: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api<{ project: Project }>(`/api/v1/projects/${id}`).then((d) => d.project),
    enabled: !!id,
  });
}
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api("/api/v1/projects", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api(`/api/v1/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["project", id] }); },
  });
}
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });
}

// Tasks
export interface TaskFilter { status?: string; search?: string; projectId?: string; dueFrom?: string; dueTo?: string; priority?: string; tags?: string }
export function useTasks(filter: TaskFilter = {}) {
  const { activeWorkspaceId } = useWorkspace();
  const params = new URLSearchParams();
  if (activeWorkspaceId) params.set("workspaceId", activeWorkspaceId);
  Object.entries(filter).forEach(([k, v]) => v && params.set(k, String(v)));
  params.set("limit", "100");
  const key = ["tasks", activeWorkspaceId, JSON.stringify(filter)];
  return useQuery({
    queryKey: key,
    queryFn: () => api<{ data: Task[] } | Task[]>(`/api/v1/tasks?${params}`).then((d) => (Array.isArray(d) ? d : ((d as unknown as { data: Task[] }).data ?? []))),
    placeholderData: (prev) => prev,
  });
}
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const temp = newTempTask(input);
      return offlineFirst(
        { kind: "task", op: "create", tempId: temp._id, payload: { ...input } },
        () => api<{ task: Task }>("/api/v1/tasks", { method: "POST", body: JSON.stringify(input) }),
        { task: temp },
        () => offlineCache.prependTaskToCache(temp)
      );
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["goals"] }); },
  });
}
export function useTask(id?: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api<{ task: Task }>(`/api/v1/tasks/${id}`).then((d) => d.task),
    enabled: !!id,
  });
}
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      offlineFirst(
        { kind: "task", op: "update", id, payload: { ...input } },
        () => api<{ task: Task }>(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
        { task: { _id: id, ...input } as Task },
        () => offlineCache.patchTaskInCache(id, input as Partial<Task>)
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["task", (v as { id: string }).id] });
    },
  });
}
export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      offlineFirst(
        { kind: "task", op: "toggle", id },
        () => api(`/api/v1/tasks/${id}/complete`, { method: "PATCH", body: "{}" }),
        {},
        () => offlineCache.toggleTaskInCache(id)
      ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
}
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      offlineFirst(
        { kind: "task", op: "delete", id },
        () => api(`/api/v1/tasks/${id}`, { method: "DELETE" }),
        {},
        () => offlineCache.removeTaskFromCache(id)
      ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
}
export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, position }: { id: string; status: string; position?: number }) =>
      offlineFirst(
        { kind: "task", op: "move", id, payload: { status, position } },
        () => api(`/api/v1/tasks/${id}/move`, { method: "PATCH", body: JSON.stringify({ status, position }) }),
        {},
        () => offlineCache.patchTaskInCache(id, { status: status as Task["status"] })
      ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });
}

// Goals / Notes / Focus
export function useGoals() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["goals", activeWorkspaceId],
    queryFn: () => api<{ data: Goal[] } | Goal[]>(`/api/v1/goals${activeWorkspaceId ? `?workspaceId=${activeWorkspaceId}` : ""}`).then((d) => (Array.isArray(d) ? d : ((d as unknown as { data: Goal[] }).data ?? []))),
  });
}
export function useNotes(search?: string) {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["notes", activeWorkspaceId, search ?? ""],
    queryFn: () => {
      const p = new URLSearchParams();
      if (activeWorkspaceId) p.set("workspaceId", activeWorkspaceId);
      if (search) p.set("search", search);
      return api<{ data: Note[] } | Note[]>(`/api/v1/notes?${p}`).then((d) => (Array.isArray(d) ? d : ((d as unknown as { data: Note[] }).data ?? [])));
    },
  });
}
export function useFocusSessions() {
  return useQuery({
    queryKey: ["focus"],
    queryFn: () => api<{ sessions: FocusSession[]; todayStats: { totalSec: number; count: number } }>("/api/v1/focus"),
  });
}
