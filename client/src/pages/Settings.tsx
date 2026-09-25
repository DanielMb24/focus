import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, useWorkspaces, useCreateWorkspace } from "../lib/hooks";
import { useWorkspace, useUI } from "../store/ui";
import { api, setAccessToken } from "../lib/api";
import { Topbar } from "../components/layout/Shell";
import { NativeDownloads } from "../components/layout/NativeDownloads";
import { applyTheme, currentThemeChoice, type ThemeChoice } from "../lib/theme";
import { Card, Button } from "../components/ui/primitives";

export function Settings() {
  const { data: me } = useMe();
  const { data: workspaces = [], refetch } = useWorkspaces();
  const { setActive, activeWorkspaceId } = useWorkspace();
  const create = useCreateWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [theme, setTheme] = useState<ThemeChoice>(() => currentThemeChoice());
  const [msg, setMsg] = useState("");
  const nav = useNavigate();
  void useUI();

  useEffect(() => {
    if (me && !firstName) { setFirstName(me.firstName); setLastName(me.lastName ?? ""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  async function logout() {
    await api("/api/v1/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
    setAccessToken(null);
    nav("/login");
  }

  async function saveProfile() {
    setMsg("");
    try {
      await api("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify({ firstName, lastName: lastName || null }) });
      await qc.invalidateQueries({ queryKey: ["me"] });
      setMsg("Profil enregistré.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Échec"); }
  }

  async function changeTheme(t: ThemeChoice) {
    setTheme(t);
    applyTheme(t);
    try { await api("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify({ preferences: { theme: t } }) }); } catch { /* offline */ }
  }

  async function deleteWorkspace(id: string, wsName: string) {
    if (!window.confirm(`Supprimer l'espace « ${wsName} » ? Les projets et tâches liés seront conservés.`)) return;
    try {
      await api(`/api/v1/workspaces/${id}`, { method: "DELETE" });
      if (activeWorkspaceId === id) setActive(null);
      refetch();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Échec"); }
  }

  return (
    <div><Topbar title="Paramètres" />
      {msg && <p role="status" className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">{msg}</p>}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card><h2 className="font-black tracking-tight">Profil</h2>
          <p className="mt-1 truncate text-sm text-stone-500">{me?.email} · {me?.profileType}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-sm font-medium">Prénom<input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600" /></label>
            <label className="text-sm font-medium">Nom<input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600" /></label>
          </div>
          <Button className="mt-3" onClick={saveProfile}>Enregistrer</Button>
        </Card>
        <Card><h2 className="font-black tracking-tight">Apparence</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {([["light", "Clair"], ["dark", "Sombre"], ["system", "Système"]] as [ThemeChoice, string][]).map(([t, label]) => (
              <button key={t} onClick={() => changeTheme(t)} className={theme === t ? "rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900" : "rounded-full bg-stone-200/60 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">« Système » suit automatiquement le mode clair/sombre de votre appareil.</p>
        </Card>
        <Card><h2 className="font-black tracking-tight">Espaces</h2>
          <div className="mt-2 space-y-1">{workspaces.map((w) => (
            <div key={w._id} className="flex items-center gap-2">
              <button onClick={() => setActive(w._id)} className={activeWorkspaceId === w._id ? "flex-1 rounded-lg bg-stone-100 px-2 py-1.5 text-left text-sm font-bold dark:bg-zinc-800 dark:text-zinc-100" : "flex-1 rounded-lg px-2 py-1.5 text-left text-sm text-stone-600 hover:bg-stone-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"}>{w.name} ({w.type})</button>
              <button aria-label={`Supprimer ${w.name}`} onClick={() => deleteWorkspace(w._id, w.name)} className="rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-red-50 hover:text-red-700">✕</button>
            </div>))}
          </div>
          <div className="mt-3 flex gap-2"><input aria-label="Nom du nouvel espace" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvel espace…" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600" />
            <Button onClick={async () => { if (!name.trim()) return; const d = await create.mutateAsync({ name: name.trim(), type: "personal" }) as unknown as { workspace: { _id: string } }; setActive(d.workspace._id); setName(""); refetch(); }}>Créer</Button></div>
        </Card>
        <Card><h2 className="font-black tracking-tight">Mot de passe</h2><PasswordForm /></Card>
        <Card><h2 className="font-black tracking-tight">Session</h2><Button variant="danger" className="mt-2" onClick={logout}>Se déconnecter</Button></Card>
        <Card><h2 className="font-black tracking-tight">Application mobile & bureau</h2><NativeDownloads /></Card>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const inputCls = "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800";

  async function submit() {
    setMsg(""); setErr("");
    if (next.length < 8) { setErr("8 caractères minimum."); return; }
    if (next !== confirm) { setErr("Les mots de passe diffèrent."); return; }
    setBusy(true);
    try {
      await api("/api/v1/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      setMsg("Mot de passe modifié. Les autres sessions ont été déconnectées.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Échec"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-2 space-y-2">
      <label className="block text-sm font-medium">Mot de passe actuel<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} /></label>
      <label className="block text-sm font-medium">Nouveau (8+ caractères)<input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></label>
      <label className="block text-sm font-medium">Confirmation<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} /></label>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
      {msg && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{msg}</p>}
      <Button disabled={busy} onClick={() => void submit()}>{busy ? "…" : "Modifier"}</Button>
    </div>
  );
}
