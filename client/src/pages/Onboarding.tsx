import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { notify } from "../lib/notify";
import { queryClient } from "../lib/queryClient";
import { Button, Card } from "../components/ui/primitives";
import { cn } from "../lib/cn";

const profiles = [
  { id: "student", title: "Étudiant", desc: "Matières, devoirs, examens, révisions" },
  { id: "professional", title: "Professionnel", desc: "Projets, réunions, deadlines" },
  { id: "entrepreneur", title: "Entrepreneur", desc: "Roadmap, objectifs, équipe" },
] as const;

export function Onboarding() {
  const nav = useNavigate();
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
        void notify("Bienvenue sur Focus", "Votre espace est prêt — créez votre première tâche.", "info", "welcome");
      }
      nav("/");
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-10">
      <p className="text-xs font-medium text-zinc-400">Étape {step} / 4</p>
      <Card className="mt-2">
        {step === 1 && (<><h1 className="text-xl font-bold">Comment vous appelez-vous ?</h1>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex. Daniel" className="mt-3 w-full rounded-lg border px-3 py-2" />
          <Button className="mt-4 w-full" disabled={!firstName.trim()} onClick={() => setStep(2)}>Continuer</Button></>)}
        {step === 2 && (<><h1 className="text-xl font-bold">Quel est votre profil ?</h1>
          <div className="mt-3 space-y-2">{profiles.map((p) => (
            <button key={p.id} onClick={() => setProfileType(p.id)} className={cn("w-full rounded-xl border p-3 text-left transition", profileType === p.id ? "border-blue-700 bg-blue-50 dark:border-blue-500 dark:bg-blue-950" : "border-stone-200 hover:border-stone-400 dark:border-zinc-700 dark:hover:border-zinc-500")}>
              <span className="text-sm font-semibold">{p.title}</span><span className="block text-xs text-zinc-500">{p.desc}</span>
            </button>))}
          </div>
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setStep(1)}>Retour</Button><Button className="flex-1" onClick={() => setStep(3)}>Continuer</Button></div></>)}
        {step === 3 && (<><h1 className="text-xl font-bold">Créez votre premier espace</h1>
          <p className="text-sm text-zinc-500">Ex. Personnel, Université, Travail…</p>
          <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Ex. Université" className="mt-3 w-full rounded-lg border px-3 py-2" />
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setStep(2)}>Retour</Button><Button className="flex-1" disabled={!workspaceName.trim()} onClick={() => setStep(4)}>Continuer</Button></div></>)}
        {step === 4 && (<><h1 className="text-xl font-bold">Préférences</h1>
          <p className="text-sm text-zinc-500">Langue : français · Fuseau : Europe/Paris. Modifiables dans Paramètres.</p>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <div className="mt-4 flex gap-2"><Button variant="ghost" onClick={() => setStep(3)}>Retour</Button><Button className="flex-1" disabled={loading} onClick={finish}>{loading ? "Création…" : "Aller au dashboard"}</Button></div></>)}
      </Card>
    </div>
  );
}
