// Version embarquée : à bumper à chaque release (avec package.json + tauri.conf.json).
export const APP_VERSION = "0.1.5";

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^v/i, "");
}

/** true si `latest` est strictement plus récent que `current` (comparaison numérique par segments). */
export function isNewer(current: string, latest: string): boolean {
  const a = normalizeTag(current).split(".").map((n) => Number(n) || 0);
  const b = normalizeTag(latest).split(".").map((n) => Number(n) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if ((b[i] ?? 0) > (a[i] ?? 0)) return true;
    if ((b[i] ?? 0) < (a[i] ?? 0)) return false;
  }
  return false;
}
