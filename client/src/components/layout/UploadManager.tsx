import { useEffect, useState } from "react";
import { X, RotateCcw, UploadCloud, WifiOff } from "lucide-react";
import { useUploads } from "../../store/uploads";
import { flushPendingUploads } from "../../lib/upload";
import { flushOutbox } from "../../lib/offline";
import { pendingUploads } from "../../lib/idb";
import { cn } from "../../lib/cn";

/** Gestionnaire global d'uploads : progression, pause hors-ligne, réessai, erreurs (§83-84). */
export function UploadManager() {
  const { items, remove, clearDone } = useUploads();
  const [collapsed, setCollapsed] = useState(false);
  const active = items.filter((i) => i.status === "uploading" || i.status === "pending" || i.status === "failed" || i.status === "paused");

  useEffect(() => {
    function onOnline() { void flushPendingUploads(); void flushOutbox(); }
    function onVisible() { if (document.visibilityState === "visible") void flushOutbox(); }
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    // Rejeu au montage si file en attente
    pendingUploads.count().then((n) => { if (n > 0 && navigator.onLine) void flushPendingUploads(); }).catch(() => null);
    void flushOutbox();
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (active.length === 0) return;
    const t = setTimeout(clearDone, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length]);

  if (items.length === 0) return null;

  return (
    <div role="status" aria-label="Uploads en cours" className="animate-pop fixed bottom-24 right-4 z-40 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lift md:bottom-6 md:right-6 dark:border-zinc-700 dark:bg-zinc-900">
      <button onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-black" aria-expanded={!collapsed}>
        <UploadCloud size={16} /> Uploads ({active.length})
        <span className="ml-auto text-stone-400">{collapsed ? "+" : "–"}</span>
      </button>
      {!collapsed && (
        <div className="max-h-64 space-y-2 overflow-y-auto px-3 pb-3">
          {items.map((u) => (
            <div key={u.id} className="rounded-xl bg-stone-50 p-2.5 dark:bg-zinc-800">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-xs font-bold">{u.name}</p>
                {u.status !== "uploading" && (
                  <button aria-label="Retirer" onClick={() => remove(u.id)} className="p-0.5 text-stone-400 hover:text-stone-700"><X size={13} /></button>
                )}
              </div>
              {u.status === "uploading" && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="h-1.5 rounded-full bg-blue-700 transition-all" style={{ width: `${u.progress}%` }} /></div>
              )}
              <p className={cn("mt-1 text-[11px]", u.status === "failed" ? "font-medium text-red-700 dark:text-red-400" : "text-stone-500 dark:text-zinc-400")}>
                {u.status === "uploading" && `${u.progress}%`}
                {u.status === "pending" && <span className="flex items-center gap-1"><WifiOff size={11} /> En attente — reprendra à la reconnexion</span>}
                {u.status === "completed" && "Terminé ✓"}
                {u.status === "failed" && (u.error ?? "Échec")}
              </p>
              {u.status === "failed" && u.pendingRef && (
                <button onClick={() => void flushPendingUploads()} className="mt-1 flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-[11px] font-bold text-white">
                  <RotateCcw size={11} /> Réessayer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
