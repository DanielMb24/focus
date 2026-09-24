import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useNotifications } from "../../store/notifications";

export function Toasts() {
  const { items, toastId, dismissToast } = useNotifications();
  const toast = items.find((i) => i.id === toastId) ?? null;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 4500);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <button
      onClick={dismissToast}
      role="status"
      className="animate-pop fixed bottom-20 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-left shadow-lift md:bottom-6 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-blue-700" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{toast.title}</span>
        {toast.body && <span className="block truncate text-xs text-stone-500">{toast.body}</span>}
      </span>
      <X size={14} className="ml-auto shrink-0 text-stone-400" />
    </button>
  );
}
