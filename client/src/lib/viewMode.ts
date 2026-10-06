import { useState } from "react";

export type ViewMode = "grid" | "list";

/** Préférence d'affichage persistée (cartes / liste), par zone. */
export function useViewMode(key: string, fallback: ViewMode = "grid"): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem(`view-${key}`);
      return v === "list" || v === "grid" ? v : fallback;
    } catch {
      return fallback;
    }
  });
  function set(v: ViewMode) {
    setMode(v);
    try {
      localStorage.setItem(`view-${key}`, v);
    } catch {
      /* stockage indisponible */
    }
  }
  return [mode, set];
}
