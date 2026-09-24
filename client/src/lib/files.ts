import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getAccessToken, API_BASE } from "./api";
import { offlineFiles } from "./idb";
import type { Folder, FileAsset, FileLink, FileQuota } from "../types.files";
import { useWorkspace } from "../store/ui";

// ---- Dossiers ----
export function useFolders(parentId?: string | null, opts?: { trashed?: boolean; favorites?: boolean; search?: string }) {
  const { activeWorkspaceId } = useWorkspace();
  const params = new URLSearchParams();
  if (activeWorkspaceId) params.set("workspaceId", activeWorkspaceId);
  if (parentId !== undefined) params.set("parentId", parentId ?? "root");
  if (opts?.trashed) params.set("trashed", "true");
  if (opts?.favorites) params.set("favorites", "true");
  if (opts?.search) params.set("search", opts.search);
  return useQuery({
    queryKey: ["folders", activeWorkspaceId, parentId ?? "all", JSON.stringify(opts ?? {})],
    queryFn: () => api<{ data: Folder[] } | Folder[]>(`/api/v1/folders?${params}`).then((d) => (Array.isArray(d) ? d : d.data ?? [])),
    enabled: !!activeWorkspaceId,
  });
}
export function useFolder(id?: string | null) {
  return useQuery({
    queryKey: ["folder", id],
    queryFn: () => api<{ folder: Folder; breadcrumb: { _id: string; name: string }[]; subCount: number; fileCount: number }>(`/api/v1/folders/${id}`),
    enabled: !!id,
  });
}
function invalidateFiles(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["folders"] });
  qc.invalidateQueries({ queryKey: ["files"] });
  qc.invalidateQueries({ queryKey: ["quota"] });
}
export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; name: string; parentId?: string | null; color?: string }) =>
      api<{ folder: Folder }>("/api/v1/folders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateFiles(qc),
  });
}
export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      api(`/api/v1/folders/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidateFiles(qc),
  });
}
export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/folders/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateFiles(qc),
  });
}
export function useRestoreFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/folders/${id}/restore`, { method: "POST", body: "{}" }),
    onSuccess: () => invalidateFiles(qc),
  });
}
export function usePermanentDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/folders/${id}/permanent`, { method: "DELETE" }),
    onSuccess: () => invalidateFiles(qc),
  });
}
export function useFolderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; kind?: string }) =>
      api("/api/v1/folders/template", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateFiles(qc),
  });
}

// ---- Fichiers ----
export interface FileFilter {
  folderId?: string | null;
  search?: string;
  type?: string;
  favorites?: boolean;
  trashed?: boolean;
  sort?: string;
}
export function useFiles(filter: FileFilter = {}) {
  const { activeWorkspaceId } = useWorkspace();
  const params = new URLSearchParams();
  if (activeWorkspaceId) params.set("workspaceId", activeWorkspaceId);
  if (filter.folderId !== undefined) params.set("folderId", filter.folderId ?? "root");
  if (filter.search) params.set("search", filter.search);
  if (filter.type) params.set("type", filter.type);
  if (filter.favorites) params.set("favorites", "true");
  if (filter.trashed) params.set("trashed", "true");
  if (filter.sort) params.set("sort", filter.sort);
  params.set("limit", "100");
  return useQuery({
    queryKey: ["files", activeWorkspaceId, JSON.stringify(filter)],
    queryFn: () => api<{ data: FileAsset[] } | FileAsset[]>(`/api/v1/files?${params}`).then((d) => (Array.isArray(d) ? d : d.data ?? [])),
    enabled: !!activeWorkspaceId,
  });
}
export function useFileDetail(id?: string) {
  return useQuery({
    queryKey: ["file", id],
    queryFn: () => api<{ file: FileAsset; links: FileLink[]; breadcrumb: { _id: string; name: string }[] }>(`/api/v1/files/${id}`),
    enabled: !!id,
  });
}
export function useRecentFiles() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["files-recent", activeWorkspaceId],
    queryFn: () => api<{ files: FileAsset[] }>(`/api/v1/files/recent?workspaceId=${activeWorkspaceId}`).then((d) => d.files),
    enabled: !!activeWorkspaceId,
  });
}
export function useFavoriteFiles() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["files-favorites", activeWorkspaceId],
    queryFn: () => api<{ files: FileAsset[] }>(`/api/v1/files/favorites?workspaceId=${activeWorkspaceId}`).then((d) => d.files),
    enabled: !!activeWorkspaceId,
  });
}
export function useQuota() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["quota", activeWorkspaceId],
    queryFn: () => api<{ quota: FileQuota }>(`/api/v1/files/quota?workspaceId=${activeWorkspaceId}`).then((d) => d.quota),
    enabled: !!activeWorkspaceId,
  });
}
export function useUpdateFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      api<{ file: FileAsset }>(`/api/v1/files/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (_d, v) => { invalidateFiles(qc); qc.invalidateQueries({ queryKey: ["file", v.id] }); },
  });
}
export function useTrashFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/files/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateFiles(qc),
  });
}
export function useRestoreFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/files/${id}/restore`, { method: "POST", body: "{}" }),
    onSuccess: () => invalidateFiles(qc),
  });
}
export function usePermanentDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/files/${id}/permanent`, { method: "DELETE" }),
    onSuccess: () => invalidateFiles(qc),
  });
}

// ---- Liaisons ----
export function useEntityFiles(entityType: string, entityId?: string) {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["entity-files", entityType, entityId],
    queryFn: () =>
      api<{ files: FileAsset[]; links: FileLink[] }>(
        `/api/v1/files/by-entity?workspaceId=${activeWorkspaceId}&entityType=${entityType}&entityId=${entityId}`
      ),
    enabled: !!activeWorkspaceId && !!entityId,
  });
}
export function useLinkFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, entityType, entityId }: { fileId: string; entityType: string; entityId: string }) =>
      api(`/api/v1/files/${fileId}/link`, { method: "POST", body: JSON.stringify({ entityType, entityId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entity-files"] }),
  });
}
export function useUnlinkFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, linkId }: { fileId: string; linkId: string }) =>
      api(`/api/v1/files/${fileId}/link/${linkId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entity-files"] }),
  });
}

/** Blob authentifié pour l'aperçu (jamais d'URL publique). Copie offline prioritaire si hors ligne. */
export function useFileBlob(fileId?: string) {
  return useQuery({
    queryKey: ["file-blob", fileId],
    queryFn: async (): Promise<string> => {
      if (!fileId) throw new Error("Sans fichier");
      if (!navigator.onLine) {
        const copy = await offlineFiles.get(fileId);
        if (copy) return URL.createObjectURL(copy.blob);
        throw new Error("Fichier non disponible hors connexion");
      }
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/files/${fileId}/preview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Aperçu impossible");
      return URL.createObjectURL(await res.blob());
    },
    enabled: !!fileId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/** Blob authentifié pour l'aperçu (jamais d'URL publique). */
export function previewUrl(fileId: string): string {
  return `/api/v1/files/${fileId}/preview`;
}
