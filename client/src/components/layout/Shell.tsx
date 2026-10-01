import { NavLink, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { LayoutDashboard, CalendarDays, CheckSquare, FolderKanban, Target, StickyNote, Timer, Settings, Plus, ChevronsLeft, ChevronsRight, Home, WifiOff, Bell, BellRing, Folder, Download, Check, LogOut, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAccessToken } from "../../lib/api";
import { useUI, useWorkspace } from "../../store/ui";
import { useWorkspaces, useMe, useCreateWorkspace } from "../../lib/hooks";
import { useNotifications } from "../../store/notifications";
import { requestSystemNotifications } from "../../lib/notify";
import { useOutsideClose } from "../../lib/outside";
import { Logo } from "../ui/Logo";
import { SpeedDial } from "./SpeedDial";
import { useInstallState } from "./InstallPrompt";
import { cn } from "../../lib/cn";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/today", label: "Aujourd'hui", icon: CalendarDays },
  { to: "/tasks", label: "Mes tâches", icon: CheckSquare },
  { to: "/projects", label: "Projets", icon: FolderKanban },
  { to: "/files", label: "Fichiers", icon: Folder },
  { to: "/calendar", label: "Calendrier", icon: Home },
  { to: "/goals", label: "Objectifs", icon: Target },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/notes", label: "Notes", icon: StickyNote },
];

const wsColors = ["#1d4ed8", "#b45309", "#0e7490", "#be123c", "#6d28d9", "#047857"];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, setQuickAdd } = useUI();
  const { data: workspaces = [] } = useWorkspaces();
  const { activeWorkspaceId, setActive } = useWorkspace();
  const { data: me } = useMe();
  const createWs = useCreateWorkspace();
  const { deferred, installed, install } = useInstallState();
  const nav = useNavigate();
  return (
    <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col bg-[#0d1322] py-4 text-zinc-300 md:flex dark:border-r dark:border-zinc-800", sidebarCollapsed ? "w-[76px] px-2.5" : "w-64 px-4")}>
      <div className="flex items-center justify-between px-1">
        <button onClick={() => nav("/")} className="flex items-center gap-2.5" aria-label="Aller au dashboard">
          <Logo size={32} />
          {!sidebarCollapsed && (
            <span className="leading-none">
              <span className="font-display block text-[19px] font-bold text-white">Focus</span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Espace de travail</span>
            </span>
          )}
        </button>
        {!sidebarCollapsed && (
          <button aria-label="Réduire la sidebar" onClick={toggleSidebar} className="rounded-md p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white"><ChevronsLeft size={17} /></button>
        )}
      </div>
      {sidebarCollapsed && <button aria-label="Étendre la sidebar" onClick={toggleSidebar} className="mx-auto mt-2 rounded-md p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white"><ChevronsRight size={17} /></button>}

      <button onClick={() => setQuickAdd(true)} className={cn("btn-press mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f6bff] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]", sidebarCollapsed && "mx-auto h-10 w-10 !px-0")}>
        <Plus size={17} /> {!sidebarCollapsed && "Nouvelle tâche"}
      </button>
      {!installed && deferred && (
        <button onClick={() => void install()} title="Installer Focus comme application de bureau"
          className={cn("btn-press mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-zinc-200 hover:border-white/40 hover:text-white", sidebarCollapsed && "mx-auto h-10 w-10 !px-0")}>
          <Download size={16} /> {!sidebarCollapsed && "Télécharger l'app"}
        </button>
      )}

      <nav className="mt-5 flex-1 space-y-0.5 overflow-y-auto" aria-label="Navigation principale">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => cn("nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm", isActive ? "active bg-white/10 font-semibold text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white", sidebarCollapsed && "justify-center !px-0")}>
            <l.icon size={17} /> {!sidebarCollapsed && l.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-2 border-t border-white/10 pt-3">
        {!sidebarCollapsed && <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Espaces</p>}
        <div className="space-y-0.5">
          {workspaces.map((w, i) => (
            <button key={w._id} title={w.name} onClick={() => setActive(w._id)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition", activeWorkspaceId === w._id ? "bg-white/10 font-semibold text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: wsColors[i % wsColors.length] }} />
              {!sidebarCollapsed && <span className="truncate">{w.name}</span>}
            </button>
          ))}
        </div>
        {!sidebarCollapsed && (
          <>
            <button
              onClick={async () => {
                const name = window.prompt("Nom du nouvel espace :");
                if (!name?.trim()) return;
                const d = (await createWs.mutateAsync({ name: name.trim(), type: "personal" })) as unknown as { workspace: { _id: string } };
                setActive(d.workspace._id);
              }}
              className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[#8fb0ff] transition hover:bg-white/5 hover:text-white"
            >
              <Plus size={15} /> Nouvel espace
            </button>
            <button onClick={() => nav("/settings")} className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
              <Settings size={15} /> Paramètres
            </button>
          </>
        )}
        {!sidebarCollapsed && me && <p className="mt-1.5 truncate px-2.5 text-xs text-zinc-500">{me.firstName} · {me.email}</p>}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const item = "flex flex-col items-center gap-1 text-[11px] font-medium text-stone-500 transition active:scale-95";
  const active = ({ isActive }: { isActive: boolean }) => cn(item, isActive ? "text-stone-900 dark:text-zinc-100" : "dark:text-zinc-400");
  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pt-2 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
      <div className="grid grid-cols-5 items-center px-2">
        <NavLink to="/" className={active}><LayoutDashboard size={21} />Accueil</NavLink>
        <NavLink to="/tasks" className={active}><CheckSquare size={21} />Tâches</NavLink>
        <SpeedDial />
        <NavLink to="/projects" className={active}><FolderKanban size={21} />Projets</NavLink>
        <NavLink to="/today" className={active}><CalendarDays size={21} />Jour</NavLink>
      </div>
    </nav>
  );
}

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { online } = useUI();
  const { items, markAllRead, clear } = useNotifications();
  const [panelOpen, setPanelOpen] = useState(false);
  const [sysOn, setSysOn] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const bellRef = useRef<HTMLDivElement>(null);
  useOutsideClose(panelOpen, bellRef, () => setPanelOpen(false));
  const unread = items.filter((i) => !i.read).length;

  async function enableSystem() {
    const ok = await requestSystemNotifications();
    setSysOn(ok);
  }

  return (
    <header className="mb-6 border-b border-[#e3e7ee] pb-5 dark:border-zinc-800">
      {!online && <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800"><WifiOff size={15} /> Hors ligne — vos modifications seront synchronisées.</div>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {subtitle && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1d4ed8]">{subtitle}</p>}
          <h1 className="mt-1 truncate text-[32px] font-bold leading-[1.1]">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <div ref={bellRef} className="relative">
          <button aria-label={`Notifications${unread ? `, ${unread} non lue(s)` : ""}`} aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}
            className="relative rounded-lg border border-stone-200 bg-white p-2.5 text-stone-600 transition hover:border-stone-400 hover:text-stone-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {unread ? <BellRing size={18} /> : <Bell size={18} />}
            {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 text-[11px] font-bold text-white">{unread}</span>}
          </button>
          {panelOpen && (
            <div role="dialog" aria-label="Centre de notifications" className="animate-pop absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5 dark:border-zinc-700">
                <p className="text-sm font-black">Notifications</p>
                <button onClick={() => { markAllRead(); }} className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline">Tout marquer lu</button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-stone-500">Aucune notification pour le moment.</p>}
                {items.map((n) => (
                  <div key={n.id} className={cn("flex gap-2.5 rounded-lg px-2.5 py-2", !n.read && "bg-blue-50/60 dark:bg-zinc-800/60")}>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-700" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{n.title}</p>
                      {n.body && <p className="line-clamp-2 text-xs text-stone-500">{n.body}</p>}
                      <p className="mt-0.5 text-[11px] text-stone-400">{new Date(n.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2.5 dark:border-zinc-700">
                {sysOn
                  ? <p className="text-xs text-stone-500">Notifications système activées.</p>
                  : <button onClick={enableSystem} className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline">Activer les notifications système</button>}
                {items.length > 0 && <button onClick={clear} className="text-xs text-stone-400 hover:text-red-700">Tout effacer</button>}
              </div>
            </div>
          )}
          </div>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

/** Avatar en haut : profil, switch d'espace de travail, déconnexion. */
function ProfileMenu() {
  const { data: me } = useMe();
  const { data: workspaces = [] } = useWorkspaces();
  const { activeWorkspaceId, setActive } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(open, ref, () => setOpen(false));
  const nav = useNavigate();
  const qc = useQueryClient();
  const initial = (me?.firstName?.[0] ?? "?").toUpperCase();

  async function logout() {
    await api("/api/v1/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
    setAccessToken(null);
    qc.clear();
    setOpen(false);
    nav("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button aria-label="Menu du profil" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-700 text-sm font-black text-white transition hover:bg-blue-800">
        {me?.avatar ? <img src={me.avatar} alt="" className="h-full w-full object-cover" /> : initial}
      </button>
      {open && (
        <div role="dialog" aria-label="Profil et espaces" className="animate-pop absolute right-0 top-12 z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2.5 border-b border-stone-200 px-4 py-3 dark:border-zinc-700">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-black text-white">{initial}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{me?.firstName} {me?.lastName ?? ""}</p>
              <p className="truncate text-xs text-stone-500">{me?.email}</p>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-2">
            <p className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-widest text-stone-400">Espaces de travail</p>
            {workspaces.map((w) => (
              <button key={w._id} onClick={() => { setActive(w._id); setOpen(false); }}
                className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition", activeWorkspaceId === w._id ? "bg-stone-100 font-bold dark:bg-zinc-800" : "hover:bg-stone-50 dark:hover:bg-zinc-800")}>
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                {activeWorkspaceId === w._id && <Check size={15} className="shrink-0 text-blue-700 dark:text-blue-400" />}
              </button>
            ))}
          </div>
          <div className="border-t border-stone-200 p-2 dark:border-zinc-700">
            <button onClick={() => { setOpen(false); nav("/settings"); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition hover:bg-stone-100">
              <UserRound size={15} className="text-stone-500" /> Profil & paramètres
            </button>
            <button onClick={() => void logout()} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50">
              <LogOut size={15} /> Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

