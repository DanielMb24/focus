import {
  AlignmentType, Document, ExternalHyperlink, HeadingLevel, LevelFormat,
  Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import type { JSONContent } from "@tiptap/react";
import { downloadBlob } from "./noteDoc";

type InlineNode = JSONContent;

function markProps(marks: { type: string; attrs?: Record<string, unknown> }[] | undefined) {
  const has = (t: string) => (marks ?? []).some((m) => m.type === t);
  return { bold: has("bold"), italics: has("italic"), underline: has("underline") ? {} : undefined, strike: has("strike"), font: has("code") ? "Consolas" : undefined };
}

function inlineRuns(nodes?: InlineNode[], forceItalic = false): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = [];
  for (const n of nodes ?? []) {
    if (n.type === "text") {
      const marks = (n.marks ?? []) as { type: string; attrs?: Record<string, unknown> }[];
      const link = marks.find((m) => m.type === "link");
      const href = String((link?.attrs as { href?: string } | undefined)?.href ?? "");
      const run = new TextRun({ text: n.text ?? "", ...markProps(marks), italics: forceItalic || markProps(marks).italics });
      out.push(link && href ? new ExternalHyperlink({ link: href, children: [run] }) : run);
    } else if (n.type === "hardBreak") {
      out.push(new TextRun({ break: 1 }));
    }
  }
  return out.length ? out : [new TextRun({ text: "" })];
}

function alignOf(node: JSONContent) {
  const a = (node.attrs as { textAlign?: string } | undefined)?.textAlign;
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  if (a === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlockChild = Paragraph | Table;

function blocksToDocx(nodes: JSONContent[] | undefined, depth = 0): BlockChild[] {
  const out: BlockChild[] = [];
  for (const n of nodes ?? []) {
    switch (n.type) {
      case "paragraph":
        out.push(new Paragraph({ alignment: alignOf(n), children: inlineRuns(n.content) }));
        break;
      case "heading": {
        const l = Math.min(3, Math.max(1, Number((n.attrs as { level?: number } | undefined)?.level ?? 1)));
        out.push(new Paragraph({
          heading: l === 1 ? HeadingLevel.HEADING_1 : l === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          alignment: alignOf(n), children: inlineRuns(n.content),
        }));
        break;
      }
      case "bulletList":
        for (const item of n.content ?? []) {
          for (const b of item.content ?? []) {
            if (b.type === "paragraph") out.push(new Paragraph({ bullet: { level: depth }, children: inlineRuns(b.content) }));
            else out.push(...blocksToDocx([b], depth + 1));
          }
        }
        break;
      case "orderedList": {
        for (const item of n.content ?? []) {
          for (const b of item.content ?? []) {
            if (b.type === "paragraph") out.push(new Paragraph({ numbering: { reference: "focus-nums", level: depth }, children: inlineRuns(b.content) }));
            else out.push(...blocksToDocx([b], depth + 1));
          }
        }
        break;
      }
      case "taskList":
        for (const item of n.content ?? []) {
          const checked = (item.attrs as { checked?: boolean } | undefined)?.checked;
          const inner = (item.content ?? []).flatMap((b) => (b.type === "paragraph" ? inlineRuns(b.content) : []));
          out.push(new Paragraph({ bullet: { level: depth }, children: [new TextRun({ text: checked ? "☒ " : "☐ " }), ...inner] }));
        }
        break;
      case "blockquote": {
        const inner = (n.content ?? []).flatMap((b) => (b.type === "paragraph" ? inlineRuns(b.content, true) : []));
        out.push(new Paragraph({ indent: { left: 720 }, children: inner }));
        break;
      }
      case "codeBlock": {
        const code = (n.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : "")).join("");
        out.push(new Paragraph({
          shading: { fill: "F2F4F8", type: ShadingType.CLEAR },
          children: [new TextRun({ text: code, font: "Consolas", size: 20 })],
        }));
        break;
      }
      case "horizontalRule":
        out.push(new Paragraph({ children: [new TextRun({ text: "─".repeat(24), color: "9AA3AF" })] }));
        break;
      case "image":
        out.push(new Paragraph({ children: [new TextRun({ text: "[image]", color: "9AA3AF", italics: true })] }));
        break;
      case "table": {
        const rows = (n.content ?? []).map((r) => new TableRow({
          children: (r.content ?? []).map((cell) => {
            const paras = (cell.content ?? []).flatMap((b): Paragraph[] => {
              if (b.type === "paragraph") return [new Paragraph({ children: inlineRuns(b.content) })];
              return [];
            });
            return new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, children: paras.length ? paras : [new Paragraph({ children: [new TextRun({ text: "" })] })] });
          }),
        }));
        if (rows.length) out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
        break;
      }
      default:
        out.push(...blocksToDocx(n.content, depth));
        break;
    }
  }
  return out;
}

/** Exporte le document en .docx (Word). */
export async function exportNoteDocx(title: string, doc: JSONContent, filename: string): Promise<void> {
  const children: BlockChild[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title || "Sans titre" })] }),
    new Paragraph({ children: [new TextRun({ text: `Exporté de Focus le ${new Date().toLocaleDateString("fr-FR")}`, color: "5B6472", size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: "" })] }),
    ...blocksToDocx(doc.content),
  ];
  const file = new Document({
    numbering: {
      config: [{ reference: "focus-nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START }] }],
    },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(file);
  downloadBlob(blob, filename);
}

/** Exporte en PDF via la boîte d'impression (fidélité maximale). */
export function printNote(title: string, bodyHtml: string, meta: string): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
<style>
  @page { margin: 18mm 15mm; }
  body { font-family: Roboto, Arial, sans-serif; color: #14181f; line-height: 1.6; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 20px; margin: 1.2em 0 0.3em; } h3 { font-size: 16px; margin: 1em 0 0.3em; }
  p { margin: 0.5em 0; } ul, ol { padding-left: 1.4em; } li { margin: 0.2em 0; }
  ul.tasks { list-style: none; padding-left: 0; }
  blockquote { border-left: 3px solid #1d4ed8; margin: 0.8em 0; padding: 0.2em 0 0.2em 1em; color: #3d4451; font-style: italic; }
  pre { background: #f2f4f8; border-radius: 8px; padding: 12px 14px; font-size: 12px; overflow-x: auto; }
  code { font-family: Consolas, monospace; } mark { background: #fef08a; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; } th, td { border: 1px solid #d4d9e2; padding: 6px 10px; text-align: left; } th { background: #f2f4f8; }
  hr { border: none; border-top: 1px solid #d4d9e2; margin: 1.2em 0; }
  img { max-width: 100%; border-radius: 8px; }
  .meta { color: #5b6472; font-size: 12px; margin-bottom: 1.5em; }
</style></head><body>
<h1>${title.replace(/</g, "&lt;")}</h1><p class="meta">${meta.replace(/</g, "&lt;")}</p>
${bodyHtml}
</body></html>`);
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  frame.contentWindow?.addEventListener("afterprint", cleanup);
  setTimeout(() => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(cleanup, 3000); }, 250);
}
