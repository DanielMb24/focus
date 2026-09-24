import { useEffect, type RefObject } from "react";

/** Ferme un panneau/popover au clic hors zone + Échap. */
export function useOutsideClose<T extends HTMLElement>(open: boolean, ref: RefObject<T | null>, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, onClose]);
}
