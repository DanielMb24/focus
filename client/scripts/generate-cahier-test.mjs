// Génère docs/Cahier-de-test-Focus-v1.0.docx depuis docs/CAHIER_DE_TEST.md
// Usage : node scripts/generate-cahier-test.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun,
  HeadingLevel, WidthType, ShadingType, AlignmentType, Footer,
} from "docx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const md = readFileSync(join(root, "docs", "CAHIER_DE_TEST.md"), "utf8");

function runs(text) {
  const out = [];
  for (const part of String(text).split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) out.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    else out.push(new TextRun({ text: part.replace(/`/g, "") }));
  }
  return out.length ? out : [new TextRun({ text: "" })];
}

const GREEN = "C6EFCE";
const widths = [8, 16, 30, 30, 16];

function mdTable(rows) {
  const body = rows.filter((r) => !/^\|?\s*-+/.test(r.cells.join("")));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: body.map((r, i) => new TableRow({
      children: r.cells.map((c, j) => new TableCell({
        width: { size: widths[j] ?? 20, type: WidthType.PERCENTAGE },
        shading: i === 0 ? { fill: GREEN, type: ShadingType.CLEAR } : undefined,
        children: [new Paragraph({ children: runs(c.trim()).map((t) => { t.bold = t.bold || i === 0; return t; }) })],
      })),
    })),
  });
}

const children = [];
const lines = md.split("\n");
let i = 0;
let tableBuf = null;
function flushTable() {
  if (tableBuf && tableBuf.length > 1) children.push(mdTable(tableBuf));
  tableBuf = null;
}

for (; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith("|")) {
    const cells = line.split("|").slice(1, -1);
    if (!tableBuf) tableBuf = [];
    tableBuf.push({ cells });
    continue;
  }
  flushTable();
  if (line.startsWith("# ")) {
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: runs(line.slice(2)) }));
  } else if (line.startsWith("## ")) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(line.slice(3)) }));
  } else if (/^[-*] /.test(line)) {
    children.push(new Paragraph({ text: "", bullet: { level: 0 }, children: runs(line.slice(2)) }));
  } else if (/^\d+\. /.test(line)) {
    children.push(new Paragraph({ numbering: undefined, children: runs(line.replace(/^\d+\. /, "")) }));
  } else if (line.trim() === "" || line.trim() === "---") {
    children.push(new Paragraph({ text: "" }));
  } else {
    children.push(new Paragraph({ children: runs(line) }));
  }
}
flushTable();

const doc = new Document({
  sections: [{
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Focus · Cahier de test v1.0", size: 18, color: "6B7280" })],
        })],
      }),
    },
    children,
  }],
});

const outPath = join(root, "docs", "Cahier-de-test-Focus-v1.0.docx");
writeFileSync(outPath, await Packer.toBuffer(doc));
console.log("OK ->", outPath);
