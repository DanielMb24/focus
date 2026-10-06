import { useNotifications } from "../store/notifications";
import { useNotifPrefs, categoryForKind, inQuietHours } from "../store/notificationPrefs";

/** Notification interne (centre + toast) et externe (système, si autorisée).
 *  `key` : anti-doublon — même clé + même contenu récent = pas de doublon.
 *  Respecte les préférences (catégories) et les heures calmes (système coupé). */
export async function notify(title: string, body?: string, kind = "info", key?: string): Promise<void> {
  const prefs = useNotifPrefs.getState();
  if (!prefs.enabled) return;
  const cat = categoryForKind(kind);
  if (!prefs.categories[cat]) return;
  useNotifications.getState().push({ title, body, kind, key });
  if (inQuietHours()) return;
  try {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const reg = await navigator.serviceWorker?.ready;
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, { body, icon: "/pwa-192x192.png", badge: "/pwa-192x192.png", tag: `focus-${Date.now()}` });
      } else {
        new Notification(title, { body });
      }
    }
  } catch {
    /* notifications système indisponibles : l'interne suffit */
  }
}

export async function requestSystemNotifications(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}
