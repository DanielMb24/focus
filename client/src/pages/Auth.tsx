import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { api, setAccessToken } from "../lib/api";
import { Button } from "../components/ui/primitives";
import { useState } from "react";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = z.object({
  firstName: z.string().min(1), email: z.string().email(), password: z.string().min(8),
  profileType: z.enum(["student", "professional", "entrepreneur"]),
});

const inputCls = "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-stone-600";

function AuthShell({ title, sub, children, footer }: { title: string; sub: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="anim-page auth-bg relative mx-auto flex min-h-full w-full max-w-md flex-col justify-center overflow-hidden px-4 py-10 [&>*]:relative [&>*]:z-[1]">
      <div className="animate-fade-up flex items-center gap-2.5">
        <Logo size={36} />
        <span className="text-xl font-black tracking-tight">Focus</span>
      </div>
      <h1 className="animate-fade-up mt-6 text-2xl font-black tracking-tight" style={{ animationDelay: "60ms" }}>{title}</h1>
      <p className="animate-fade-up mt-1 text-sm text-stone-500" style={{ animationDelay: "120ms" }}>{sub}</p>
      <div className="animate-pop mt-5 rounded-xl border border-stone-200 bg-white p-6 shadow-lift dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </div>
      <div className="mt-4 text-center text-sm text-stone-500">{footer}</div>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  return (
    <AuthShell title="Bon retour" sub="Que devez-vous accomplir aujourd'hui ?" footer={<>Pas de compte ? <Link to="/register" className="font-bold text-blue-600">Créer un compte</Link></>}>
      <form onSubmit={handleSubmit(async (f) => {
        try {
          const d = await api<{ accessToken: string; user: { onboardingCompleted: boolean; emailVerified?: boolean }; requiresVerification?: boolean }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(f) });
          setAccessToken(d.accessToken);
          if (d.requiresVerification || d.user.emailVerified === false) { nav("/verify-email"); return; }
          nav(d.user.onboardingCompleted ? "/" : "/onboarding");
        } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
      })} className="stagger space-y-3.5">
        <label className="block text-sm font-medium">Email<input {...register("email")} type="email" placeholder="vous@exemple.com" className={inputCls} /></label>
        <label className="block text-sm font-medium">Mot de passe<input {...register("password")} type="password" placeholder="••••••••" className={inputCls} /></label>
        <p className="text-right text-xs"><Link to="/forgot-password" className="font-bold text-blue-700 dark:text-blue-400">Mot de passe oublié ?</Link></p>
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null} Se connecter</Button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { profileType: "student" } });
  return (
    <AuthShell title="Bienvenue" sub="Créez votre espace de productivité" footer={<>Déjà inscrit ? <Link to="/login" className="font-bold text-blue-600">Se connecter</Link></>}>
      <form onSubmit={handleSubmit(async (f) => {
        try {
          const d = await api<{ accessToken: string; requiresVerification?: boolean }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(f) });
          setAccessToken(d.accessToken); nav(d.requiresVerification ? "/verify-email" : "/onboarding");
        } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
      })} className="stagger space-y-3.5">
        <label className="block text-sm font-medium">Prénom<input {...register("firstName")} placeholder="Ex. Daniel" className={inputCls} /></label>
        <label className="block text-sm font-medium">Email<input {...register("email")} type="email" placeholder="vous@exemple.com" className={inputCls} /></label>
        <label className="block text-sm font-medium">Mot de passe (8+ caractères)<input {...register("password")} type="password" placeholder="••••••••" className={inputCls} /></label>
        <label className="block text-sm font-medium">Profil
          <select {...register("profileType")} className={inputCls}>
            <option value="student">Étudiant</option><option value="professional">Professionnel</option><option value="entrepreneur">Entrepreneur</option>
          </select>
        </label>
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null} Créer mon compte</Button>
      </form>
    </AuthShell>
  );
}


