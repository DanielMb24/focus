import { useEffect, useState } from "react";
import { Download, Apple, MonitorSmartphone, RefreshCw } from "lucide-react";
import { InstallButton } from "./InstallPrompt";
import { APP_VERSION, isNewer } from "../../lib/version";
import { fetchLatestRelease, type ReleaseInfo } from "../../lib/updater";

const APK_URL = import.meta.env.VITE_APK_URL as string | undefined;
const EXE_URL = import.meta.env.VITE_EXE_URL as string | undefined;

/** Téléchargements natifs + détection de mise à jour (GitHub Releases). */
export function NativeDownloads() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  useEffect(() => {
    fetchLatestRelease().then(setRelease).catch(() => null);
  }, []);
  const hasUpdate = release ? isNewer(APP_VERSION, release.tag) : false;
  const apkUrl = release?.apkUrl ?? APK_URL;
  const exeUrl = release?.exeUrl ?? EXE_URL;

  return (
    <div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500"><MonitorSmartphone size={14} /> PWA : installable depuis le navigateur, sans téléchargement.</p>
      <InstallButton />
      {hasUpdate && release && (
        <div role="status" className="animate-pop mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm dark:border-emerald-900 dark:bg-emerald-950">
          <p className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-200"><RefreshCw size={14} /> Focus {release.tag} disponible (vous avez v{APP_VERSION})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={release.htmlUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">Voir la mise à jour</a>
            {apkUrl && <a href={apkUrl} download className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-800">Télécharger l'APK</a>}
            {exeUrl && <a href={exeUrl} download className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-800">Télécharger l'exe</a>}
          </div>
        </div>
      )}
      {apkUrl && (
        <a href={apkUrl} download className="btn-press mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
          <Download size={15} /> Télécharger l'APK Android
        </a>
      )}
      {exeUrl && (
        <a href={exeUrl} download className="btn-press mt-2 flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-stone-700">
          <Download size={15} /> Télécharger pour Windows (.exe)
        </a>
      )}
      {!apkUrl && !exeUrl && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-400">
          <Apple size={13} className="mt-0.5 shrink-0" />
          Sur iPhone : ouvrez l'app dans Safari → Partager → « Sur l'écran d'accueil ».
        </p>
      )}
      <p className="mt-2 text-[11px] text-stone-400">Version installée : v{APP_VERSION}</p>
    </div>
  );
}
