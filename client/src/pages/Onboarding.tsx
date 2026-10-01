import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { notify } from "../lib/notify";
import { queryClient } from "../lib/queryClient";
import { Button, Card } from "../components/ui/primitives";
import { useMe } from "../lib/hooks";
import { cn } from "../lib/cn";

const profiles = [
  { id: "student", title: "Étudiant", desc: "Matières, devoirs, examens, révisions" },
  { id: "professional", title: "Professionnel", desc: "Projets, réunions, deadlines" },
  { id: "entrepreneur", title: "Entrepreneur", desc: "Roadmap, objectifs, équipe" },
] as const;

const inputCls = "field-control mt-3 w-full";

export function Onboarding() {
  const nav = useNavigate();
  const { data: me } = useMe();
  useEffect(() => {
    if (me && me.emailVerified === false) nav("/verify-email", { replace: true });
  }, [me, nav]);
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [profileType, setProfileType] = useState<"student" | "professional" | "entrepreneur">("student");
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function finish() {
    setLoading(true); setErr("");
    try {
      await api("/api/v1/auth/onboarding", { method: "POST", body: JSON.stringify({ firstName, profileType, workspaceName, workspaceType: "personal", language: "fr", timezone: "Europe/Paris" }) });
      await queryClient.invalidateQueries();
      if (!localStorage.getItem("welcome-notified")) {
        localStorage.setItem("welcome-notified", "1");
        void notify("Bienvenue sur Focus", "Votre espace est prêt.", "info", "welcome");
      }
      nav("/");
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-10">
      <p className="kicker">Étape {step} / 4</p>
      <Card className="mt-2">
        {step === 1 && (<><h1 className="text-lg font-bold tracking-tight">Comment vous appelez-vous ?</h1>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex. Daniel" className={inputCls} aria-label="Votre prénom" />
          <Button className="mt-4 w-full" disabled={!firstName.trim()} onClick={() => setStep(2)}>Continuer</Button></>)}
        {step === 2 && (<><h1 className="text-lg font-bold tracking-tight">Quel est votre profil ?</h1>
          <div className="mt-3 space-y-2">{profiles.map((p) => (
            <button key={p.id} onClick={() => setProfileType(p.id)} className={cn("w-full rounded-xl border p-3 text-left transition", profileType === p.id ? "border-stone-900 bg-stone-100 dark:border-zinc-100 dark:bg-zinc-800" : "border-stone-200 hover:border-stone-400 dark:border-zinc-700 dark:hover:border-zinc-500")}>
              <span className="text-sm font-semibold">{p.title}</span><span className="block text-xs text-stone-500 dark:text-zinc-400">{p.desc}</span>
            </button>))}
          </div>
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setStep(1)}>Retour</Button><Button className="flex-1" onClick={() => setStep(3)}>Continuer</Button></div></>)}
        {step === 3 && (<><h1 className="text-lg font-bold tracking-tight">Créez votre premier espace</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">Ex. Personnel, Université, Travail…</p>
          <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Ex. Université" className={inputCls} aria-label="Nom de l'espace" />
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setStep(2)}>Retour</Button><Button className="flex-1" disabled={!workspaceName.trim()} onClick={() => setStep(4)}>Continuer</Button></div></>)}
        {step === 4 && (<><h1 className="text-lg font-bold tracking-tight">Préférences</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">Langue : français · Fuseau : Europe/Paris. Modifiables dans Paramètres.</p>
          {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setStep(3)}>Retour</Button><Button className="flex-1" disabled={loading} onClick={finish}>{loading ? "Création…" : "Aller au tableau de bord"}</Button></div></>)}
      </Card>
    </div>
  );
}
