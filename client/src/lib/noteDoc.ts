import type { JSONContent } from "@tiptap/react";

/** Contenu stocké : JSON TipTap, ou texte brut historique. */
export function parseNoteContent(content?: string | null): JSONContent {
  if (!content) return { type: "doc", content: [{ type: "paragraph" }] };
  const raw = content.trim();
  if (raw.startsWith("{")) {
    try {
      const doc = JSON.parse(raw) as JSONContent;
      if (doc && doc.type === "doc" && Array.isArray(doc.content)) return doc;
    } catch {
      /* pas du JSON : traité comme texte brut ci-dessous */
    }
  }
  const blocks = raw.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
  if (blocks.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };
  return {
    type: "doc",
    content: blocks.map((t) => ({
      type: "paragraph",
      content: t.split("\n").flatMap((line, i) =>
        i === 0 ? [{ type: "text", text: line }] : [{ type: "hardBreak" }, { type: "text", text: line }]
      ),
    })),
  };
}

export function isEmptyDoc(doc: JSONContent): boolean {
  const text = docToText(doc).trim();
  return text.length === 0;
}

interface FlatBlock { text: string; prefix: string }

function blockText(node: JSONContent, prefix = ""): FlatBlock[] {
  if (!node) return [];
  if (node.type === "text") return [{ text: node.text ?? "", prefix }];
  if (node.type === "hardBreak") return [{ text: "\n", prefix: "" }];
  const kids = (node.content ?? []).flatMap((c) => blockText(c));
  switch (node.type) {
    case "taskItem": {
      const checked = (node.attrs as { checked?: boolean } | undefined)?.checked;
      return [{ text: kids.map((k) => k.text).join(""), prefix: checked ? "☒ " : "☐ " }];
    }
    case "listItem":
      return [{ text: kids.map((k) => k.text).join(""), prefix: "• " }];
    default:
      return kids;
  }
}

/** Texte brut du document (paragraphes séparés par une ligne vide). */
export function docToText(doc: JSONContent): string {
  const blocks: string[] = [];
  for (const n of doc.content ?? []) {
    if (n.type === "bulletList" || n.type === "orderedList" || n.type === "taskList") {
      for (const item of n.content ?? []) {
        const parts = blockText(item);
        const prefix = parts[0]?.prefix ?? "";
        blocks.push(prefix + parts.map((p) => p.text).join(""));
      }
    } else {
      const parts = blockText(n);
      const prefix = parts[0]?.prefix ?? "";
      blocks.push(prefix + parts.map((p) => p.text).join(""));
    }
  }
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

export interface DocHeading { level: number; text: string }

export function docHeadings(doc: JSONContent): DocHeading[] {
  const out: DocHeading[] = [];
  const walk = (nodes?: JSONContent[]) => {
    for (const n of nodes ?? []) {
      if (n.type === "heading") {
        const text = (n.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : "")).join("").trim();
        if (text) out.push({ level: Math.min(3, Math.max(1, Number((n.attrs as { level?: number } | undefined)?.level ?? 1))), text });
      }
      walk(n.content);
    }
  };
  walk(doc.content);
  return out;
}

export function wordCount(text: string): number {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return text.trim() ? w.length : 0;
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.ceil(wordCount(text) / 200));
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineHtml(nodes?: JSONContent[]): string {
  return (nodes ?? []).map((n) => {
    if (n.type === "text") {
      let t = esc(n.text ?? "");
      const marks = n.marks ?? [];
      const has = (m: string) => marks.some((x) => x.type === m);
      const link = marks.find((x) => x.type === "link");
      if (has("code")) t = `<code>${t}</code>`;
      if (has("bold")) t = `<strong>${t}</strong>`;
      if (has("italic")) t = `<em>${t}</em>`;
      if (has("underline")) t = `<u>${t}</u>`;
      if (has("strike")) t = `<s>${t}</s>`;
      if (has("highlight")) t = `<mark>${t}</mark>`;
      if (link) t = `<a href="${esc(String((link.attrs as { href?: string } | undefined)?.href ?? "#"))}">${t}</a>`;
      return t;
    }
    if (n.type === "hardBreak") return "<br>";
    return "";
  }).join("");
}

function alignStyle(node: JSONContent): string {
  const a = (node.attrs as { textAlign?: string } | undefined)?.textAlign;
  return a && a !== "left" ? ` style="text-align:${a}"` : "";
}

function blockHtml(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      return `<p${alignStyle(node)}>${inlineHtml(node.content) || "<br>"}</p>`;
    case "heading": {
      const l = Math.min(3, Math.max(1, Number((node.attrs as { level?: number } | undefined)?.level ?? 1)));
      return `<h${l}${alignStyle(node)}>${inlineHtml(node.content)}</h${l}>`;
    }
    case "bulletList":
      return `<ul>${(node.content ?? []).map(blockHtml).join("")}</ul>`;
    case "orderedList":
      return `<ol>${(node.content ?? []).map(blockHtml).join("")}</ol>`;
    case "taskList":
      return `<ul class="tasks">${(node.content ?? []).map(blockHtml).join("")}</ul>`;
    case "listItem":
      return `<li>${(node.content ?? []).map(blockHtml).join("")}</li>`;
    case "taskItem": {
      const checked = (node.attrs as { checked?: boolean } | undefined)?.checked;
      return `<li>${checked ? "☒" : "☐"} ${(node.content ?? []).map(blockHtml).join("")}</li>`;
    }
    case "blockquote":
      return `<blockquote>${(node.content ?? []).map(blockHtml).join("")}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${esc((node.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : "")).join(""))}</code></pre>`;
    case "horizontalRule":
      return "<hr>";
    case "image": {
      const a = node.attrs as { src?: string; alt?: string } | undefined;
      return a?.src ? `<img src="${esc(a.src)}" alt="${esc(a.alt ?? "")}">` : "";
    }
    case "table":
      return `<table>${(node.content ?? []).map(blockHtml).join("")}</table>`;
    case "tableRow":
      return `<tr>${(node.content ?? []).map(blockHtml).join("")}</tr>`;
    case "tableHeader":
      return `<th>${(node.content ?? []).map(blockHtml).join("")}</th>`;
    case "tableCell":
      return `<td>${(node.content ?? []).map(blockHtml).join("")}</td>`;
    default:
      return (node.content ?? []).map(blockHtml).join("");
  }
}

/** HTML simple du document (impression / aperçu). */
export function docToHtml(doc: JSONContent): string {
  return (doc.content ?? []).map(blockHtml).join("\n");
}

function inlineMd(nodes?: JSONContent[]): string {
  return (nodes ?? []).map((n) => {
    if (n.type === "text") {
      let t = n.text ?? "";
      const marks = n.marks ?? [];
      const has = (m: string) => marks.some((x) => x.type === m);
      const link = marks.find((x) => x.type === "link");
      // Échapper d'abord les caractères Markdown du texte brut
      t = t.replace(/([\\`*_~[\]])/g, "\\$1");
      if (has("code")) t = `\`${t}\``;
      if (has("bold")) t = `**${t}**`;
      if (has("italic")) t = `*${t}*`;
      if (has("strike")) t = `~~${t}~~`;
      if (has("highlight")) t = `==${t}==`;
      if (link) t = `[${t}](${(link.attrs as { href?: string } | undefined)?.href ?? "#"})`;
      return t;
    }
    if (n.type === "hardBreak") return "  \n";
    return "";
  }).join("");
}

function blockMd(node: JSONContent, indent = ""): string {
  switch (node.type) {
    case "paragraph":
      return `${indent}${inlineMd(node.content)}`;
    case "heading": {
      const l = Math.min(3, Math.max(1, Number((node.attrs as { level?: number } | undefined)?.level ?? 1)));
      return `${"#".repeat(l)} ${inlineMd(node.content)}`;
    }
    case "bulletList":
      return (node.content ?? []).map((c) => `${indent}- ${blockMd(c, `${indent}  `).trimStart()}`).join("\n");
    case "orderedList": {
      let i = 0;
      return (node.content ?? []).map((c) => { i += 1; return `${indent}${i}. ${blockMd(c, `${indent}   `).trimStart()}`; }).join("\n");
    }
    case "taskList":
      return (node.content ?? []).map((c) => {
        const checked = (c.attrs as { checked?: boolean } | undefined)?.checked;
        const inner = (c.content ?? []).map((b) => blockMd(b, `${indent}      `).trimStart()).join("\n");
        return `${indent}- [${checked ? "x" : " "}] ${inner}`;
      }).join("\n");
    case "listItem":
      return (node.content ?? []).map((b) => blockMd(b, indent)).join("\n");
    case "taskItem":
      return (node.content ?? []).map((b) => blockMd(b, indent)).join("\n");
    case "blockquote": {
      const inner = (node.content ?? []).map((b) => blockMd(b)).join("\n");
      return inner.split("\n").map((l) => `${indent}> ${l}`).join("\n");
    }
    case "codeBlock":
      return `${indent}\`\`\`\n${(node.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : "")).join("")}\n${indent}\`\`\``;
    case "horizontalRule":
      return `${indent}---`;
    case "image": {
      const a = node.attrs as { src?: string; alt?: string } | undefined;
      return a?.src ? `${indent}![${a.alt ?? ""}](${a.src})` : "";
    }
    case "table": {
      const rows = (node.content ?? []).map((r) => (r.content ?? []).map((cell) =>
        (cell.content ?? []).map((b) => blockMd(b)).join(" ").replace(/\|/g, "\\|").trim()
      ));
      if (rows.length === 0) return "";
      const head = rows[0] ?? [];
      const sep = head.map(() => "---");
      return [head, sep, ...rows.slice(1)].map((r) => `${indent}| ${r.join(" | ")} |`).join("\n");
    }
    default:
      return (node.content ?? []).map((b) => blockMd(b, indent)).join("\n");
  }
}

/** Markdown du document (export .md). */
export function docToMarkdown(doc: JSONContent): string {
  return (doc.content ?? []).map((b) => blockMd(b)).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Nom de fichier sûr à partir du titre. */
export function slugFilename(title: string, ext: string): string {
  const base = title.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "note";
  return `${base}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
