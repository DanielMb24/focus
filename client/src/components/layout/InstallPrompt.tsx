import { useEffect, useRef, useState } from "react";
import { Download, X, Share, RefreshCw } from "lucide-react";
import { isMobileDevice } from "../../lib/capabilities";
import { useOutsideClose } from "../../lib/outside";
import { APP_VERSION, isNewer } from "../../lib/version";
import { fetchLatestRelease, type ReleaseInfo } from "../../lib/updater";
import { Logo } from "../ui/Logo";

const APK_URL = import.meta.env.VITE_APK_URL as string | undefined;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone;
}

export function useInstallState() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isInstalled);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("install-dismissed") === "1");

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() { setInstalled(true); }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
    return outcome === "accepted";
  }

  function dismiss() {
    localStorage.setItem("install-dismissed", "1");
    setDismissed(true);
  }

  return { deferred, installed, dismissed, install, dismiss };
}

/** Bannière d'installation : bureau (Chrome/Edge) comme téléphone (Android + consigne iOS). */
export function InstallPrompt() {
  const { deferred, installed, dismissed, install, dismiss } = useInstallState();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(!hidden && !dismissed && !installed, ref, () => setHidden(true));
  useEffect(() => {
    fetchLatestRelease().then(setRelease).catch(() => null);
  }, []);
  if (installed || dismissed || hidden) return null;

  // Mise à jour RÉELLE détectée : la bannière propose la mise à jour, pas un téléchargement générique.
  const hasUpdate = release ? isNewer(APP_VERSION, release.tag) : false;
  const updateUrl = release?.apkUrl ?? release?.exeUrl ?? release?.htmlUrl ?? APK_URL;

  async function onInstall() {
    setBusy(true);
    const ok = await install();
    if (!ok) dismiss();
    setBusy(false);
  }

  return (
    <div ref={ref} role="dialog" aria-label="Installer l'application" className="animate-pop fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-stone-200 bg-white p-4 shadow-lift md:bottom-6 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <Logo size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">{hasUpdate && release ? `Mettre à jour Focus (${release.tag})` : "Installer Focus"}</p>
          {hasUpdate && release ? (
            <p className="mt-0.5 text-xs text-stone-500">Une vraie mise à jour est disponible (vous avez v{APP_VERSION}).</p>
          ) : deferred ? (
            <p className="mt-0.5 text-xs text-stone-500">Accès direct depuis le bureau ou l'écran d'accueil, mode plein écran, hors-ligne.</p>
          ) : isIOS() ? (
            <p className="mt-0.5 text-xs text-stone-500">Sur iPhone : touchez <Share size={11} className="inline" /> Partager puis « Sur l'écran d'accueil ».</p>
          ) : APK_URL ? (
            <p className="mt-0.5 text-xs text-stone-500">Ou installez directement le fichier Android ci-dessous.</p>
          ) : (
            <p className="mt-0.5 text-xs text-stone-500">Menu du navigateur → « Installer l'application ».</p>
          )}
        </div>
        <button aria-label="Fermer" onClick={dismiss} className="rounded p-1 text-stone-400 hover:bg-stone-100"><X size={15} /></button>
      </div>
      {hasUpdate && updateUrl ? (
        <a href={updateUrl} className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
          <RefreshCw size={15} /> Mettre à jour Focus
        </a>
      ) : deferred ? (
        <button onClick={() => void onInstall()} disabled={busy} className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800">
          <Download size={15} /> {busy ? "…" : isMobileDevice() ? "Installer l'application" : "Télécharger"}
        </button>
      ) : APK_URL ? (
        <a href={APK_URL} download className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
          <Download size={15} /> Télécharger l'APK
        </a>
      ) : null}
    </div>
  );
}

/** Bouton réutilisable (ex. page Paramètres). */
export function InstallButton() {
  const { deferred, installed, install } = useInstallState();
  const [busy, setBusy] = useState(false);
  if (installed) return <p className="mt-1 text-sm font-medium text-emerald-700">Application installée ✓</p>;
  if (!deferred) {
    return <p className="mt-1 text-sm text-stone-500">{isIOS() ? "Sur iPhone : Partager → « Sur l'écran d'accueil »." : "Menu du navigateur → « Installer l'application »."}</p>;
  }
  return (
    <button
      onClick={() => { setBusy(true); void install().finally(() => setBusy(false)); }}
      disabled={busy}
      className="btn-press mt-2 flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
    >
      <Download size={15} /> {busy ? "…" : "Installer l'application"}
    </button>
  );
}
