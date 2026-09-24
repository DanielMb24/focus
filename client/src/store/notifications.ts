import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Notice {
  id: string;
  title: string;
  body?: string;
  kind: string;
  at: number;
  read: boolean;
}

interface NoticeState {
  items: Notice[];
  toastId: string | null;
  push: (n: { title: string; body?: string; kind?: string }) => void;
  dismissToast: () => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotifications = create<NoticeState>()(
  persist(
    (set) => ({
      items: [],
      toastId: null,
      push: (n) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({
          items: [{ id, title: n.title, body: n.body, kind: n.kind ?? "info", at: Date.now(), read: false }, ...s.items].slice(0, 30),
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
