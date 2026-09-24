import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, X, FolderPlus, LayoutDashboard, CalendarDays, CheckSquare, FolderKanban,
  Folder, Calendar, Target, StickyNote, Timer,
} from "lucide-react";
import { useUI, useWorkspace } from "../../store/ui";
import { useCreateProject } from "../../lib/hooks";
import { cn } from "../../lib/cn";

const ACTIONS_ANIM_MS = 40;

export function SpeedDial() {
  const [open, setOpen] = useState(false);
  const [projectMode, setProjectMode] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [err, setErr] = useState("");
  const { setQuickAdd } = useUI();
  const { activeWorkspaceId } = useWorkspace();
  const createProject = useCreateProject();
  const nav = useNavigate();

  function close() { setOpen(false); setProjectMode(false); setProjectName(""); setErr(""); }

  async function submitProject() {
    setErr("");
    if (!projectName.trim()) { setErr("Nom requis."); return; }
    if (!activeWorkspaceId) { setErr("Aucun espace actif."); return; }
    try {
      const d = (await createProject.mutateAsync({ workspaceId: activeWorkspaceId, name: projectName.trim(), color: "#1d4ed8" })) as unknown as { project: { _id: string } };
      close();
      nav(`/projects/${d.project._id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Échec"); }
  }

  const go = (to: string) => { close(); nav(to); };
  const actions = [
    { label: "+ Tâche", icon: Plus, cls: "bg-blue-700 text-white", run: () => { close(); setQuickAdd(true); } },
    { label: "+ Projet", icon: FolderPlus, cls: "bg-violet-700 text-white", run: () => setProjectMode(true) },
    { label: "Accueil", icon: LayoutDashboard, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/") },
    { label: "Jour", icon: CalendarDays, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/today") },
    { label: "Tâches", icon: CheckSquare, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/tasks") },
    { label: "Projets", icon: FolderKanban, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/projects") },
    { label: "Fichiers", icon: Folder, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/files") },
    { label: "Calendrier", icon: Calendar, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/calendar") },
    { label: "Objectifs", icon: Target, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/goals") },
    { label: "Notes", icon: StickyNote, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/notes") },
    { label: "Focus", icon: Timer, cls: "bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-200", run: () => go("/focus") },
  ];

  return (
    <>
      {open && <div aria-hidden onClick={close} className="animate-overlay fixed inset-0 z-40 bg-stone-950/40 md:hidden" />}

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 md:hidden" aria-hidden={!open}>
        <div className={cn(
          "pointer-events-auto flex max-w-full items-start gap-2 overflow-x-auto rounded-2xl border border-stone-200 bg-white/95 px-3 py-3 shadow-lift backdrop-blur transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-900/95",
          open ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0"
        )}>
          {actions.map((a, i) => (
            <div
              key={a.label}
              className="fan-item flex w-12 shrink-0 flex-col items-center gap-1.5"
              style={open
                ? { transform: "translateY(0)", opacity: 1, transitionDelay: `${i * ACTIONS_ANIM_MS}ms` }
                : { transform: "translateY(14px)", opacity: 0, transitionDelay: "0ms" }}
            >
              <button
                aria-label={a.label}
                tabIndex={open ? 0 : -1}
                onClick={a.run}
                className={cn("btn-press flex h-12 w-12 items-center justify-center rounded-full shadow-lift", a.cls)}
              >
                <a.icon size={20} />
              </button>
              <span className="text-[10px] font-bold text-stone-600 dark:text-zinc-300">{a.label}</span>
            </div>
          ))}
        </div>

        {projectMode && (
          <div className="animate-pop pointer-events-auto absolute bottom-full left-1/2 mb-3 w-64 -translate-x-1/2 rounded-2xl border border-stone-200 bg-white p-4 shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-black">Nouveau projet</p>
            <input autoFocus value={projectName} onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitProject(); }}
              placeholder="Nom du projet…" aria-label="Nom du projet"
              className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800" />
            {err && <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">{err}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setProjectMode(false)} className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100">Annuler</button>
              <button onClick={submitProject} disabled={createProject.isPending} className="rounded-lg bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
                {createProject.isPending ? "…" : "Créer"}
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        aria-label={open ? "Fermer le menu" : "Actions rapides"}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="btn-press mx-auto flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-blue-700 text-white shadow-lift hover:bg-blue-800"
      >
        <span className={cn("transition-transform duration-200", open && "rotate-45")}>
          {open ? <X size={22} /> : <Plus size={22} />}
        </span>
      </button>
    </>
  );
}
