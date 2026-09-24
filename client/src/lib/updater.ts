import { notify } from "./notify";

/** Tauri uniquement : mise à jour silencieuse au démarrage (télécharge + installe + relance). */
export async function checkNativeUpdate(): Promise<void> {
  try {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return;
    await notify("Mise à jour disponible", `Installation de Focus v${update.version}…`);
    await update.downloadAndInstall();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch {
    /* navigateur ou hors ligne : ignoré silencieusement */
  }
}

export interface ReleaseInfo { tag: string; htmlUrl: string; apkUrl: string | null; exeUrl: string | null }

/** Dernière release GitHub publique (pour APK et téléchargements manuels). */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch("https://api.github.com/DanielMb24/focus/releases/latest");
    if (!res.ok) return null;
    const j = (await res.json()) as { tag_name: string; html_url: string; assets: { name: string; browser_download_url: string }[] };
    const find = (re: RegExp) => j.assets.find((a) => re.test(a.name))?.browser_download_url ?? null;
    return {
      tag: j.tag_name,
      htmlUrl: j.html_url,
      apkUrl: find(/\.apk$/i),
      exeUrl: find(/-setup\.exe$/i) ?? find(/\.msi$/i),
    };
  } catch {
    return null;
  }
}
