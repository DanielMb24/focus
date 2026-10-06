import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotifCategory = "tasks" | "focus" | "chat" | "system";

interface PrefsState {
  enabled: boolean;
  categories: Record<NotifCategory, boolean>;
  /** Heures calmes "HH:MM" (système uniquement). Vide = désactivé. */
  quietStart: string;
  quietEnd: string;
  setEnabled: (v: boolean) => void;
  toggleCategory: (c: NotifCategory) => void;
  setQuiet: (which: "quietStart" | "quietEnd", v: string) => void;
}

export const NOTIF_CATEGORIES: { id: NotifCategory; label: string; hint: string }[] = [
  { id: "tasks", label: "Tâches", hint: "Échéances, retards, bilan du jour" },
  { id: "focus", label: "Focus", hint: "Fin de session, minuteur" },
  { id: "chat", label: "Messages", hint: "Nouveaux messages reçus" },
  { id: "system", label: "Système", hint: "Synchronisation, mises à jour" },
];

export const useNotifPrefs = create<PrefsState>()(
  persist(
    (set) => ({
      enabled: true,
      categories: { tasks: true, focus: true, chat: true, system: true },
      quietStart: "",
      quietEnd: "",
      setEnabled: (enabled) => set({ enabled }),
      toggleCategory: (c) => set((s) => ({ categories: { ...s.categories, [c]: !s.categories[c] } })),
      setQuiet: (which, v) => set({ [which]: v }),
    }),
    { name: "notif-prefs" }
  )
);

/** Catégorie déduite du `kind` passé à notify(). */
export function categoryForKind(kind: string): NotifCategory {
  const k = kind.toLowerCase();
  if (k.startsWith("task")) return "tasks";
  if (k.startsWith("focus")) return "focus";
  if (k.startsWith("chat") || k.startsWith("message")) return "chat";
  return "system";
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Heures calmes (gère le chevauchement minuit, ex. 22:00 → 07:00). */
export function inQuietHours(now = new Date()): boolean {
  const { quietStart, quietEnd } = useNotifPrefs.getState();
  const s = toMinutes(quietStart);
  const e = toMinutes(quietEnd);
  if (s === null || e === null) return false;
  const n = now.getHours() * 60 + now.getMinutes();
  return s <= e ? n >= s && n < e : n >= s || n < e;
}
