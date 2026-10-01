import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter, Code2,
  Heading1, Heading2, Heading3, Type, List, ListOrdered, ListTodo, Quote,
  SquareCode, Minus, Link2, Link2Off, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Eraser,   Table, TableProperties, Trash2, Rows3, Columns3,
} from "lucide-react";
import { cn } from "../../lib/cn";

function Tool({ title, active, onClick, disabled, children }: {
  title: string; active?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-30",
        active ? "bg-[#1d4ed8] text-white" : "text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
      )}
    >
      {children}
    </button>
  );
}

const S = 16;

export function NoteToolbar({ editor }: { editor: Editor | null }) {
  const ed = editor;
  if (!ed) return null;
  const inTable = ed.isActive("table");

  function setLink(e: Editor) {
    const prev = e.getAttributes("link").href as string | undefined;
    const url = window.prompt("Adresse du lien :", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) { e.chain().focus().unsetLink().run(); return; }
    e.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-stone-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-5 sm:px-5 dark:border-zinc-700 dark:bg-zinc-900/95">
      <div className="flex items-center gap-0.5 overflow-x-auto">
        <Tool title="Annuler" onClick={() => ed.chain().focus().undo().run()} disabled={!ed.can().undo()}><Undo2 size={S} /></Tool>
        <Tool title="Rétablir" onClick={() => ed.chain().focus().redo().run()} disabled={!ed.can().redo()}><Redo2 size={S} /></Tool>
        <span className="mx-1 h-5 w-px shrink-0 bg-stone-200 dark:bg-zinc-700" />
        <Tool title="Titre 1" active={ed.isActive("heading", { level: 1 })} onClick={() => ed.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={S} /></Tool>
        <Tool title="Titre 2" active={ed.isActive("heading", { level: 2 })} onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={S} /></Tool>
        <Tool title="Titre 3" active={ed.isActive("heading", { level: 3 })} onClick={() => ed.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={S} /></Tool>
        <Tool title="Texte normal" active={ed.isActive("paragraph")} onClick={() => ed.chain().focus().setParagraph().run()}><Type size={S} /></Tool>
        <span className="mx-1 h-5 w-px shrink-0 bg-stone-200 dark:bg-zinc-700" />
        <Tool title="Gras" active={ed.isActive("bold")} onClick={() => ed.chain().focus().toggleBold().run()}><Bold size={S} /></Tool>
        <Tool title="Italique" active={ed.isActive("italic")} onClick={() => ed.chain().focus().toggleItalic().run()}><Italic size={S} /></Tool>
        <Tool title="Souligné" active={ed.isActive("underline")} onClick={() => ed.chain().focus().toggleUnderline().run()}><UnderlineIcon size={S} /></Tool>
        <Tool title="Barré" active={ed.isActive("strike")} onClick={() => ed.chain().focus().toggleStrike().run()}><Strikethrough size={S} /></Tool>
        <Tool title="Surligné" active={ed.isActive("highlight")} onClick={() => ed.chain().focus().toggleHighlight().run()}><Highlighter size={S} /></Tool>
        <Tool title="Code" active={ed.isActive("code")} onClick={() => ed.chain().focus().toggleCode().run()}><Code2 size={S} /></Tool>
        <span className="mx-1 h-5 w-px shrink-0 bg-stone-200 dark:bg-zinc-700" />
        <Tool title="Liste à puces" active={ed.isActive("bulletList")} onClick={() => ed.chain().focus().toggleBulletList().run()}><List size={S} /></Tool>
        <Tool title="Liste numérotée" active={ed.isActive("orderedList")} onClick={() => ed.chain().focus().toggleOrderedList().run()}><ListOrdered size={S} /></Tool>
        <Tool title="Liste de tâches" active={ed.isActive("taskList")} onClick={() => ed.chain().focus().toggleTaskList().run()}><ListTodo size={S} /></Tool>
        <Tool title="Citation" active={ed.isActive("blockquote")} onClick={() => ed.chain().focus().toggleBlockquote().run()}><Quote size={S} /></Tool>
        <Tool title="Bloc de code" active={ed.isActive("codeBlock")} onClick={() => ed.chain().focus().toggleCodeBlock().run()}><SquareCode size={S} /></Tool>
        <Tool title="Séparateur" onClick={() => ed.chain().focus().setHorizontalRule().run()}><Minus size={S} /></Tool>
        <span className="mx-1 h-5 w-px shrink-0 bg-stone-200 dark:bg-zinc-700" />
        <Tool title="Lien" active={ed.isActive("link")} onClick={() => setLink(ed)}><Link2 size={S} /></Tool>
        <Tool title="Retirer le lien" onClick={() => ed.chain().focus().unsetLink().run()} disabled={!ed.isActive("link")}><Link2Off size={S} /></Tool>
        <Tool title="Aligner à gauche" active={ed.isActive({ textAlign: "left" })} onClick={() => ed.chain().focus().setTextAlign("left").run()}><AlignLeft size={S} /></Tool>
        <Tool title="Centrer" active={ed.isActive({ textAlign: "center" })} onClick={() => ed.chain().focus().setTextAlign("center").run()}><AlignCenter size={S} /></Tool>
        <Tool title="Aligner à droite" active={ed.isActive({ textAlign: "right" })} onClick={() => ed.chain().focus().setTextAlign("right").run()}><AlignRight size={S} /></Tool>
        <Tool title="Effacer la mise en forme" onClick={() => ed.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser size={S} /></Tool>
        <span className="mx-1 h-5 w-px shrink-0 bg-stone-200 dark:bg-zinc-700" />
        <Tool title="Insérer un tableau 3×3" onClick={() => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table size={S} /></Tool>
        {inTable && (
          <>
            <Tool title="Options du tableau" active onClick={() => undefined}><TableProperties size={S} /></Tool>
            <Tool title="Ajouter une ligne" onClick={() => ed.chain().focus().addRowAfter().run()}><Rows3 size={S} /></Tool>
            <Tool title="Ajouter une colonne" onClick={() => ed.chain().focus().addColumnAfter().run()}><Columns3 size={S} /></Tool>
            <Tool title="Supprimer le tableau" onClick={() => ed.chain().focus().deleteTable().run()}><Trash2 size={S} /></Tool>
          </>
        )}
      </div>
    </div>
  );
}
