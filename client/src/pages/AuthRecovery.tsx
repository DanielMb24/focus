import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, setAccessToken, ApiError } from "../lib/api";
import { useMe } from "../lib/hooks";
import { Button, Card } from "../components/ui/primitives";

const inputCls = "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400";

/** Écran imposé tant que l'email n'est pas vérifié. */
export function VerifyEmail() {
  const nav = useNavigate();
  const { data: me, refetch } = useMe();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (me?.emailVerified) nav(me.onboardingCompleted ? "/" : "/onboarding", { replace: true });
  }, [me, nav]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit() {
    if (!me?.email || code.trim().length < 4) { setErr("Saisissez le code à 6 chiffres."); return; }
    setBusy(true); setErr(""); setInfo("");
    try {
      const d = await api<{ accessToken: string }>("/api/v1/auth/verify-email", {
        method: "POST", body: JSON.stringify({ email: me.email, code: code.trim() }),
      });
      setAccessToken(d.accessToken);
      await refetch();
      setInfo("Email vérifié !");
    } catch (e) { setErr(e instanceof Error ? e.message : "Code invalide."); }
    finally { setBusy(false); }
  }

  async function resend() {
    if (!me?.email || cooldown > 0) return;
    setBusy(true); setErr(""); setInfo("");
    try {
      await api("/api/v1/auth/resend-code", { method: "POST", body: JSON.stringify({ email: me.email }) });
      setInfo("Nouveau code envoyé.");
      setCooldown(60);
    } catch (e) { setErr(e instanceof Error ? e.message : "Échec."); }
    finally { setBusy(false); }
  }

  return (
    <div className="anim-page mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-black tracking-tight">Vérifiez votre email</h1>
      <p className="mt-1 text-sm text-stone-500">Un code à 6 chiffres a été envoyé à <span className="font-bold">{me?.email ?? "…"}</span> (valable 10 minutes).</p>
      <Card className="mt-6">
        <label className="block text-sm font-medium">Code
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="123456" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            className={`${inputCls} text-center text-2xl font-black tracking-[0.5em]`} />
        </label>
        {err && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
        {info && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{info}</p>}
        <Button className="mt-4 w-full" disabled={busy} onClick={() => void submit()}>{busy ? "Vérification…" : "Vérifier"}</Button>
        <button disabled={busy || cooldown > 0} onClick={() => void resend()} className="mt-2 w-full text-center text-sm font-medium text-blue-700 hover:underline disabled:opacity-50 dark:text-blue-400">
          {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le code"}
        </button>
      </Card>
    </div>
  );
}

const forgotSchema = z.object({ email: z.string().email("Email invalide") });

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const { register, handleSubmit } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
  return (
    <div className="anim-page mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-black tracking-tight">Mot de passe oublié</h1>
      <p className="mt-1 text-sm text-stone-500">Recevez un lien de réinitialisation valable 1 heure.</p>
      <Card className="mt-6">
        {sent ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Si un compte existe, un lien vient d'être envoyé.</p>
        ) : (
          <form onSubmit={handleSubmit(async (f) => {
            try { await api("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify(f) }); setSent(true); }
            catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
          })} className="space-y-3">
            <label className="block text-sm font-medium">Email<input {...register("email")} type="email" className={inputCls} /></label>
            {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
            <Button type="submit" className="w-full">Envoyer le lien</Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-stone-500"><Link to="/login" className="font-bold text-blue-700 dark:text-blue-400">Retour à la connexion</Link></p>
      </Card>
    </div>
  );
}

const resetSchema = z.object({ newPassword: z.string().min(8, "8 caractères minimum"), confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { message: "Les mots de passe diffèrent.", path: ["confirm"] });

export function ResetPassword() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  if (!token || !email) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Lien invalide. Redemandez un lien depuis la page de connexion.</p>
        <p className="mt-4 text-center text-sm"><Link to="/login" className="font-bold text-blue-700 dark:text-blue-400">Se connecter</Link></p>
      </div>
    );
  }

  return (
    <div className="anim-page mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-black tracking-tight">Nouveau mot de passe</h1>
      <Card className="mt-6">
        <form onSubmit={handleSubmit(async (f) => {
          try {
            const d = await api<{ accessToken: string }>("/api/v1/auth/reset-password", {
              method: "POST", body: JSON.stringify({ email, token, newPassword: f.newPassword }),
            });
            setAccessToken(d.accessToken);
            nav("/");
          } catch (e) {
            setErr(e instanceof ApiError && e.code === "FORBIDDEN" ? "Lien invalide ou expiré — redemandez-en un." : (e instanceof Error ? e.message : "Erreur"));
          }
        })} className="space-y-3">
          <label className="block text-sm font-medium">Nouveau mot de passe (8+ caractères)<input {...register("newPassword")} type="password" className={inputCls} /></label>
          <label className="block text-sm font-medium">Confirmation<input {...register("confirm")} type="password" className={inputCls} /></label>
          {(errors.newPassword ?? errors.confirm) && <p className="text-xs text-red-700">{errors.newPassword?.message ?? errors.confirm?.message}</p>}
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          <Button type="submit" className="w-full">Réinitialiser</Button>
        </form>
      </Card>
    </div>
  );
}
