export interface Folder {
  _id: string; workspaceId: string; name: string; parentId: string | null;
  createdBy: string; color?: string; icon?: string; isFavorite: boolean;
  trashedAt?: string | null; createdAt: string; updatedAt: string;
}
export type EntityType = "task" | "project" | "note" | "goal";
export interface FileAsset extends Record<string, unknown> {
  _id: string; workspaceId: string; folderId: string | null; uploadedBy: string;
  name: string; originalName: string; extension?: string; mimeType: string;
  size: number; storageKey: string; storageProvider: string; checksum?: string;
  isFavorite: boolean; status: "uploading" | "ready" | "failed" | "trashed";
  trashedAt?: string | null; lastOpenedAt?: string | null;
  metadata?: { width?: number; height?: number; duration?: number };
  createdAt: string; updatedAt: string;
}
export interface FileLink { _id: string; workspaceId: string; fileId: string; entityType: EntityType; entityId: string; }
export interface FileQuota { used: number; limit: number; count: number }
