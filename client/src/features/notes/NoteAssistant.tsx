import { useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { Link } from "react-router-dom";
import { Sparkles, Copy, Check, ListChecks, Loader2 } from "lucide-react";
import { docToText, parseNoteContent } from "../../lib/noteDoc";
import { extractActions, noteStats, relatedNotes, suggestTitle, summarize } from "../../lib/noteAssist";
import { useCreateTask } from "../../lib/hooks";
import { useWorkspace } from "../../store/ui";
import { Button } from "../../components/ui/primitives";
import { cn } from "../../lib/cn";
import type { Note } from "../../types";

function parseDueHint(hint?: string): string | undefined {
  if (!hint) return undefined;
  const m = hint.match(/(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/);
  if (m) {
    let year = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]), 12);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const low = hint.toLowerCase();
  const d = new Date();
  if (/demain/.test(low)) { d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d.toISOString(); }
  if (/semaine prochaine/.test(low)) { d.setDate(d.getDate() + 7); d.setHours(12, 0, 0, 0); return d.toISOString(); }
  if (/cette semaine/.test(low)) { d.setDate(d.getDate() + 3); d.setHours(12, 0, 0, 0); return d.toISOString(); }
  return undefined;
}

function actionBlocks(doc: JSONContent): { text: string; unchecked: boolean }[] {
  const out: { text: string; unchecked: boolean }[] = [];
  const textOf = (n: JSONContent): string =>
    (n.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : c.type === "hardBreak" ? "\n" : textOf(c))).join("");
  for (const b of doc.content ?? []) {
    if (b.type === "taskList") {
      for (const item of b.content ?? []) {
        out.push({ text: textOf(item), unchecked: !(item.attrs as { checked?: boolean } | undefined)?.checked });
      }
    } else {
      out.push({ text: textOf(b), unchecked: false });
    }
  }
  return out;
}

const tabs = [
  { id: "resume", label: "Résumé" },
  { id: "actions", label: "Actions" },
  { id: "plan", label: "Plan" },
  { id: "links", label: "Liées" },
] as const;

export function NoteAssistant({ doc, noteId, notes, onApplyTitle }: {
  doc: JSONContent; noteId: string; notes: Note[]; onApplyTitle: (t: string) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("resume");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const createTask = useCreateTask();
  const { activeWorkspaceId } = useWorkspace();

  const text = useMemo(() => docToText(doc), [doc]);
  const stats = useMemo(() => noteStats(text), [text]);
  const summary = useMemo(() => summarize(text), [text]);
  const actions = useMemo(() => extractActions(actionBlocks(doc)), [doc]);
  const titleIdea = useMemo(() => suggestTitle(text), [text]);
  const links = useMemo(() => {
    const pool = notes.map((n) => ({ id: n._id, title: n.title, text: docToText(parseNoteContent(n.content)) }));
    return relatedNotes(noteId, text, pool);
  }, [notes, noteId, text]);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers indisponible */ }
  }

  async function createAllActions() {
    if (!activeWorkspaceId || actions.length === 0) return;
    setBusy(true);
    setDone(0);
    let n = 0;
    for (const a of actions) {
      try {
        await createTask.mutateAsync({ workspaceId: activeWorkspaceId, title: a.text.slice(0, 140), priority: "medium", dueDate: parseDueHint(a.dueHint) });
        n += 1;
        setDone(n);
      } catch { /* on continue avec les suivantes */ }
    }
    setBusy(false);
  }

  return (
    <section aria-label="Assistant" className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3 dark:border-zinc-700">
        <Sparkles size={15} className="text-[#1d4ed8]" />
        <p className="text-sm font-bold">Assistant local</p>
        <span title="Analyse effectuée sur votre appareil, rien n'est envoyé à un serveur." className="cursor-help rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:bg-zinc-800">hors-ligne</span>
      </div>
      <div className="flex gap-1 border-b border-stone-200 px-3 pt-2 dark:border-zinc-700" role="tablist" aria-label="Outils assistant">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("rounded-t-lg px-3 py-1.5 text-[13px] font-semibold transition",
              tab === t.id ? "bg-stone-100 text-stone-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-stone-400 hover:text-stone-700")}>
            {t.label}
            {t.id === "actions" && actions.length > 0 && <span className="ml-1 rounded-full bg-[#1d4ed8] px-1.5 text-[11px] font-bold text-white">{actions.length}</span>}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-y-auto p-4">
        {tab === "resume" && (
          <div>
            {titleIdea && (
              <div className="mb-3 rounded-lg bg-stone-50 p-2.5 dark:bg-zinc-800">
                <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Titre proposé</p>
                <p className="mt-0.5 text-sm font-medium">{titleIdea}</p>
                <button onClick={() => onApplyTitle(titleIdea)} className="mt-1 text-xs font-bold text-blue-700 hover:underline">Appliquer ce titre</button>
              </div>
            )}
            {summary.length === 0 ? (
              <p className="text-sm text-stone-500">Écrivez quelques phrases pour obtenir un résumé.</p>
            ) : (
              <>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">
                  {summary.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
                <button onClick={copySummary} className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline">
                  {copied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier le résumé</>}
                </button>
              </>
            )}
          </div>
        )}
        {tab === "actions" && (
          <div>
            {actions.length === 0 ? (
              <p className="text-sm text-stone-500">Aucune action détectée. Cochez des tâches, écrivez TODO ou ajoutez une date (ex. 12/10).</p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ListChecks size={15} className="mt-0.5 shrink-0 text-stone-400" />
                      <span>{a.text}{a.dueHint && <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-500 dark:bg-zinc-800">{a.dueHint}</span>}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={createAllActions} disabled={busy || !activeWorkspaceId} className="mt-3 w-full !py-2 text-sm">
                  {busy ? <><Loader2 size={14} className="animate-spin" /> {done}/{actions.length}…</> : `Créer ${actions.length} tâche${actions.length > 1 ? "s" : ""}`}
                </Button>
                {done > 0 && !busy && <p className="mt-1.5 text-xs text-emerald-700">{done} tâche{done > 1 ? "s" : ""} créée{done > 1 ? "s" : ""} — voir Mes tâches.</p>}
              </>
            )}
          </div>
        )}
        {tab === "plan" && (
          <PlanView doc={doc} />
        )}
        {tab === "links" && (
          <div>
            {links.length === 0 ? (
              <p className="text-sm text-stone-500">Aucune note liée pour l'instant.</p>
            ) : (
              <ul className="space-y-1.5">
                {links.map((l) => (
                  <li key={l.id}>
                    <Link to={`/notes/${l.id}`} className="block truncate rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium transition hover:border-stone-400 dark:border-zinc-700">
                      {l.title} <span className="ml-1 font-mono text-[11px] text-stone-400">+{l.shared}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-stone-200 bg-stone-50 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-stone-400 dark:border-zinc-700 dark:bg-zinc-800/50">
        {stats.words} mots · {stats.minutes} min · {stats.sentences} phrases
      </div>
    </section>
  );
}

function PlanView({ doc }: { doc: JSONContent }) {
  const items: { level: number; text: string }[] = [];
  const walk = (nodes?: JSONContent[]) => {
    for (const n of nodes ?? []) {
      if (n.type === "heading") {
        const text = (n.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
        if (text) items.push({ level: Number((n.attrs as { level?: number } | undefined)?.level ?? 1), text });
      }
      walk(n.content);
    }
  };
  walk(doc.content);
  if (items.length === 0) return <p className="text-sm text-stone-500">Ajoutez des titres (Titre 1/2/3) pour voir le plan.</p>;
  return (
    <ol className="space-y-1">
      {items.map((h, i) => (
        <li key={i} className="truncate text-sm" style={{ paddingLeft: `${(h.level - 1) * 14}px` }}>
          <span className="mr-1.5 font-mono text-[11px] text-stone-400">H{h.level}</span>{h.text}
        </li>
      ))}
    </ol>
  );
}
