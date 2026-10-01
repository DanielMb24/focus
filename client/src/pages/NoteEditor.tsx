import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { ArrowLeft, Check, CloudOff, Download, FileText, Loader2, Trash2, Copy, CopyPlus, ChevronDown } from "lucide-react";
import { useNote, useUpdateNote, useDeleteNote } from "../lib/hooks";
import { api } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { parseNoteContent, docToHtml, docToMarkdown, slugFilename, downloadBlob } from "../lib/noteDoc";
import { exportNoteDocx, printNote } from "../lib/noteExport";
import { noteExtensions } from "../features/notes/noteExtensions";
import { NoteToolbar } from "../features/notes/NoteToolbar";
import { NoteAssistant } from "../features/notes/NoteAssistant";
import { AttachFiles } from "../features/files/AttachFiles";
import { Button, Card, EmptyState, Skeleton } from "../components/ui/primitives";
import { useOutsideClose } from "../lib/outside";
import { useUI } from "../store/ui";
import { cn } from "../lib/cn";
import type { Note } from "../types";

type SaveState = "saved" | "saving" | "error";

export function NoteEditor() {
  const { noteId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { online } = useUI();
  const { data: note, isLoading, isError } = useNote(noteId);
  const update = useUpdateNote();
  const del = useDeleteNote();
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [words, setWords] = useState(0);
  const exportRef = useRef<HTMLDivElement>(null);
  useOutsideClose(exportOpen, exportRef, () => setExportOpen(false));

  const loadedId = useRef<string | null>(null);
  const docRef = useRef<JSONContent>({ type: "doc", content: [{ type: "paragraph" }] });
  const titleRef = useRef("");
  const timer = useRef<number | null>(null);

  const editor = useEditor({
    extensions: noteExtensions("Écrivez ici… (titres, listes, tableaux : tout est dans la barre d'outils)"),
    content: docRef.current,
    editorProps: { attributes: { class: "tiptap-doc" } },
    onUpdate: ({ editor: e }) => {
      docRef.current = e.getJSON();
      try { setWords(e.storage.characterCount.words() as number); } catch { /* ignore */ }
      scheduleSave();
    },
  });

  function scheduleSave() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveNow(), 900);
  }

  async function saveNow() {
    if (!noteId || loadedId.current !== noteId) return;
    if (!online) { setSaveState("error"); return; }
    setSaveState("saving");
    try {
      await update.mutateAsync({ id: noteId, title: titleRef.current.trim() || "Sans titre", content: JSON.stringify(docRef.current) });
      setSaveState("saved");
      setSavedAt(new Date().toISOString());
    } catch {
      setSaveState("error");
    }
  }

  useEffect(() => {
    if (note && loadedId.current !== note._id && editor) {
      loadedId.current = note._id;
      const doc = parseNoteContent(note.content);
      docRef.current = doc;
      editor.commands.setContent(doc, false);
      setTitle(note.title);
      titleRef.current = note.title;
      try { setWords(editor.storage.characterCount.words() as number); } catch { /* ignore */ }
      setSaveState("saved");
    }
  }, [note, editor]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function onTitleChange(v: string) {
    setTitle(v);
    titleRef.current = v;
    scheduleSave();
  }

  async function duplicate() {
    if (!note) return;
    try {
      const d = await api<{ note: Note }>("/api/v1/notes", {
        method: "POST",
        body: JSON.stringify({ workspaceId: note.workspaceId, title: `${note.title} (copie)`, content: note.content ?? "" }),
      });
      qc.invalidateQueries({ queryKey: ["notes"] });
      nav(`/notes/${d.note._id}`);
    } catch { /* erreur réseau : voir Toaster global */ }
  }

  async function remove() {
    if (!noteId) return;
    if (!window.confirm("Supprimer définitivement cette note ?")) return;
    await del.mutateAsync(noteId);
    nav("/notes");
  }

  const allNotes = qc.getQueryData<Note[]>(["notes"]) ?? [];
  const metaLine = useMemo(() => {
    if (!note) return "";
    const upd = new Date(note.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    return `Modifié le ${upd} · ${words} mots`;
  }, [note, words]);

  function currentDoc(): JSONContent {
    return editor ? editor.getJSON() : docRef.current;
  }

  async function doExport(kind: "docx" | "pdf" | "md" | "html") {
    const t = titleRef.current.trim() || note?.title || "Sans titre";
    const doc = currentDoc();
    setExportOpen(false);
    if (kind === "docx") await exportNoteDocx(t, doc, slugFilename(t, "docx"));
    else if (kind === "md") downloadBlob(new Blob([`# ${t}\n\n${docToMarkdown(doc)}\n`], { type: "text/markdown" }), slugFilename(t, "md"));
    else if (kind === "html") {
      try {
        await navigator.clipboard.writeText(docToHtml(doc));
        setCopiedHtml(true);
        setTimeout(() => setCopiedHtml(false), 2000);
      } catch { /* presse-papiers indisponible */ }
    } else printNote(t, docToHtml(doc), `${metaLine} · Exporté de Focus`);
  }

  if (isLoading) return <div className="pb-24 md:pb-8"><Skeleton className="h-10 w-64" /><Skeleton className="mt-4 h-96" /></div>;
  if (isError || !note) {
    return (
      <div className="pb-24 md:pb-8">
        <Link to="/notes" className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"><ArrowLeft size={15} /> Notes</Link>
        <div className="mt-4"><EmptyState title="Note introuvable" hint="Elle a peut-être été supprimée." action={<Link to="/notes"><Button>Voir mes notes</Button></Link>} /></div>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-8">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/notes" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"><ArrowLeft size={15} /> Notes</Link>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-stone-400" role="status">
          {saveState === "saving" ? <><Loader2 size={13} className="animate-spin" /> Enregistrement…</>
            : saveState === "error" ? <><CloudOff size={13} className="text-red-500" /> <span className="text-red-600">Non enregistré</span> <button onClick={() => void saveNow()} className="font-bold text-blue-700 hover:underline">Réessayer</button></>
              : <><Check size={13} className="text-emerald-600" /> {savedAt ? `Enregistré à ${new Date(savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Enregistré"}</>}
        </span>
        <div ref={exportRef} className="relative">
          <Button variant="outline" onClick={() => setExportOpen(!exportOpen)} className="!py-2 text-sm" aria-expanded={exportOpen}>
            <Download size={15} /> Exporter <ChevronDown size={14} className={cn("transition", exportOpen && "rotate-180")} />
          </Button>
          {exportOpen && (
            <div role="menu" className="animate-pop absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
              {[
                { k: "docx", t: "Document Word (.docx)", d: "Ouvrable dans Word, LibreOffice" },
                { k: "pdf", t: "PDF (impression)", d: "Mise en page fidèle" },
                { k: "md", t: "Markdown (.md)", d: "Texte brut structuré" },
                { k: "html", t: copiedHtml ? "HTML copié ✓" : "Copier le HTML", d: "Pour coller ailleurs" },
              ].map((o) => (
                <button key={o.k} role="menuitem" onClick={() => void doExport(o.k as "docx" | "pdf" | "md" | "html")}
                  className="block w-full px-4 py-2.5 text-left transition hover:bg-stone-50 dark:hover:bg-zinc-800">
                  <span className="flex items-center gap-2 text-sm font-semibold"><FileText size={14} className="text-stone-400" />{o.t}</span>
                  <span className="mt-0.5 block text-xs text-stone-400">{o.d}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => void duplicate()} title="Dupliquer la note" className="rounded-lg border border-stone-200 bg-white p-2.5 text-stone-500 transition hover:text-stone-900 dark:border-zinc-700 dark:bg-zinc-900"><CopyPlus size={15} /></button>
        <button onClick={() => void remove()} title="Supprimer la note" className="rounded-lg border border-stone-200 bg-white p-2.5 text-stone-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-900"><Trash2 size={15} /></button>
      </div>

      <input
        aria-label="Titre de la note" value={title} onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Titre de la note"
        className="mt-4 w-full rounded-xl border border-transparent bg-transparent px-3 py-2 text-[26px] font-bold tracking-tight outline-none transition placeholder:text-stone-300 hover:border-stone-200 focus:border-[#d4d9e2] focus:bg-white dark:hover:border-zinc-700 dark:focus:bg-zinc-900"
      />
      {metaLine && <p className="mt-1 px-3 font-mono text-[11px] uppercase tracking-wide text-stone-400">{metaLine}</p>}

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="!p-0">
          <div className="px-4 sm:px-5">
            <NoteToolbar editor={editor} />
          </div>
          <div className="px-5 pb-6 pt-2 sm:px-7">
            <EditorContent editor={editor} />
          </div>
        </Card>
        <div className="min-w-0 space-y-5">
          <NoteAssistant doc={editor?.getJSON() ?? docRef.current} noteId={note._id} notes={allNotes} onApplyTitle={onTitleChange} />
          <section aria-label="Pièces jointes">
            <AttachFiles entityType="note" entityId={note._id} />
          </section>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 px-1 text-xs text-stone-400"><Copy size={12} /> Sauvegarde automatique à chaque pause de frappe.</p>
    </div>
  );
}
