import { Download, Apple, MonitorSmartphone } from "lucide-react";
import { InstallButton } from "./InstallPrompt";

const APK_URL = import.meta.env.VITE_APK_URL as string | undefined;
const EXE_URL = import.meta.env.VITE_EXE_URL as string | undefined;

/** Téléchargements natifs : affichés uniquement si les URLs sont configurées. */
export function NativeDownloads() {
  return (
    <div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500"><MonitorSmartphone size={14} /> PWA : installable depuis le navigateur, sans téléchargement.</p>
      <InstallButton />
      {APK_URL && (
        <a href={APK_URL} download className="btn-press mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
          <Download size={15} /> Télécharger l'APK Android
        </a>
      )}
      {EXE_URL && (
        <a href={EXE_URL} download className="btn-press mt-2 flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-stone-700">
          <Download size={15} /> Télécharger pour Windows (.exe)
        </a>
      )}
      {!APK_URL && !EXE_URL && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-400">
          <Apple size={13} className="mt-0.5 shrink-0" />
          Sur iPhone : ouvrez l'app dans Safari → Partager → « Sur l'écran d'accueil ».
        </p>
      )}
    </div>
  );
}
