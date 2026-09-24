import { useNotifications } from "../store/notifications";

/** Notification interne (centre + toast) et externe (système, si autorisée). */
export async function notify(title: string, body?: string, kind = "info"): Promise<void> {
  useNotifications.getState().push({ title, body, kind });
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
