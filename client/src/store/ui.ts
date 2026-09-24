import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  quickAddOpen: boolean;
  online: boolean;
  apiDown: boolean;
  toggleSidebar: () => void;
  setQuickAdd: (v: boolean) => void;
  setOnline: (v: boolean) => void;
  setApiDown: (v: boolean) => void;
}
export const useUI = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  quickAddOpen: false,
  online: navigator.onLine,
  apiDown: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setQuickAdd: (v) => set({ quickAddOpen: v }),
  setOnline: (v) => set({ online: v }),
  setApiDown: (v) => set({ apiDown: v }),
}));

interface WSState {
  activeWorkspaceId: string | null;
  setActive: (id: string | null) => void;
}
export const useWorkspace = create<WSState>()(
  persist((set) => ({ activeWorkspaceId: null, setActive: (id) => set({ activeWorkspaceId: id }) }), { name: "ws-store" })
);
