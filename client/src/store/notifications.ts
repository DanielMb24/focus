import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Notice {
  id: string;
  title: string;
  body?: string;
  kind: string;
  key?: string;
  at: number;
  read: boolean;
}

interface NoticeState {
  items: Notice[];
  toastId: string | null;
  push: (n: { title: string; body?: string; kind?: string; key?: string }) => void;
  dismissToast: () => void;
  markAllRead: () => void;
  clear: () => void;
}

const DEDUPE_MS = 24 * 3600 * 1000;

export const useNotifications = create<NoticeState>()(
  persist(
    (set, get) => ({
      items: [],
      toastId: null,
      push: (n) => {
        // Anti-doublons : même clé + même contenu récent = on met à jour, on n'ajoute pas.
        if (n.key) {
          const existing = get().items.find(
            (i) => i.key === n.key && i.title === n.title && (i.body ?? "") === (n.body ?? "") && Date.now() - i.at < DEDUPE_MS
          );
          if (existing) {
            set((s) => ({ items: s.items.map((i) => (i.id === existing.id ? { ...i, at: Date.now() } : i)) }));
            return;
          }
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({
          items: [{ id, title: n.title, body: n.body, kind: n.kind ?? "info", key: n.key, at: Date.now(), read: false }, ...s.items].slice(0, 30),
          toastId: id,
        }));
      },
      dismissToast: () => set({ toastId: null }),
      markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
      clear: () => set({ items: [], toastId: null }),
    }),
    { name: "notif-store", partialize: (s) => ({ items: s.items }) as NoticeState }
  )
);
