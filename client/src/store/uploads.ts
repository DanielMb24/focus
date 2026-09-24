import { create } from "zustand";

export type UploadStatus = "pending" | "uploading" | "paused" | "failed" | "completed";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error?: string;
  /** présent quand l'item vient de la file IDB (binaire hors mémoire) */
  pendingRef?: string;
}

interface UploadState {
  items: UploadItem[];
  upsert: (i: UploadItem) => void;
  patch: (id: string, p: Partial<UploadItem>) => void;
  remove: (id: string) => void;
  clearDone: () => void;
}

export const useUploads = create<UploadState>()((set) => ({
  items: [],
  upsert: (i) => set((s) => (s.items.some((x) => x.id === i.id) ? { items: s.items.map((x) => (x.id === i.id ? { ...x, ...i } : x)) } : { items: [i, ...s.items].slice(0, 20) })),
  patch: (id, p) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  clearDone: () => set((s) => ({ items: s.items.filter((x) => x.status !== "completed") })),
}));
