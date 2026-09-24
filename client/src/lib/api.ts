/** Base de l'API : même origine par défaut (web/PWA), URL absolue via VITE_API_URL (Tauri/Capacitor). */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");
import { useUI } from "../store/ui";

const BASE = API_BASE;

let accessToken: string | null = localStorage.getItem("accessToken");

export function setAccessToken(t: string | null) {
  accessToken = t;
  if (t) localStorage.setItem("accessToken", t);
  else localStorage.removeItem("accessToken");
}
export function getAccessToken() { return accessToken; }

async function refreshAccess(): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/api/v1/auth/refresh`, { method: "POST", credentials: "include" });
    if (!r.ok) return null;
    const j = await r.json();
    const t = j?.data?.accessToken as string | undefined;
    if (t) { setAccessToken(t); return t; }
    return null;
  } catch { return null; }
}

export class ApiError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!BASE && typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    throw new ApiError(0, "CONFIG", "API non configurée dans ce build — réinstallez la dernière version.");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json", ...((init.headers as Record<string, string>) ?? {}) };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    // Réseau coupé, API éteinte ou CORS qui bloque : on lève le drapeau global.
    useUI.getState().setApiDown(true);
    throw new ApiError(0, "NETWORK", "Serveur injoignable");
  }
  if (useUI.getState().apiDown) useUI.getState().setApiDown(false);
  if (res.status === 401 && retry && !path.includes("/auth/")) {
    const t = await refreshAccess();
    if (t) return api<T>(path, init, false);
    setAccessToken(null);
    window.location.href = "/login";
    throw new ApiError(401, "UNAUTHORIZED", "Session expirée");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new ApiError(res.status, json?.error?.code ?? "INTERNAL", json?.error?.message ?? "Erreur serveur");
  }
  return json.data as T;
}
