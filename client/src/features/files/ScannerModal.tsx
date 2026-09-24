import { useRef, useState } from "react";
import { X, Camera, ArrowUp, ArrowDown, Trash2, FilePlus } from "lucide-react";
import { jsPDF } from "jspdf";
import { useWorkspace } from "../../store/ui";
import { uploadFiles } from "../../lib/upload";
import { Button } from "../../components/ui/primitives";

interface Page { id: string; url: string; blob: Blob }

/** Scanner multi-pages : capture → réorganisation → PDF → import (§73-74). */
export function ScannerModal({ folderId, onClose }: { folderId: string | null; onClose: () => void }) {
  const { activeWorkspaceId } = useWorkspace();
  const [pages, setPages] = useState<Page[]>([]);
  const [name, setName] = useState(`scan-${new Date().toISOString().slice(0, 10)}.pdf`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Page[] = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .map((blob) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url: URL.createObjectURL(blob), blob }));
    setPages((p) => [...p, ...next]);
  }

  function move(i: number, dir: -1 | 1) {
    setPages((p) => {
      const n = [...p];
      const j = i + dir;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  async function generate() {
    if (!pages.length || !activeWorkspaceId) return;
    setBusy(true); setErr("");
    try {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const W = 595.28, H = 841.89, M = 36;
      for (let i = 0; i < pages.length; i++) {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("Image illisible"));
          el.src = pages[i].url;
        });
        const ratio = Math.min((W - 2 * M) / img.naturalWidth, (H - 2 * M) / img.naturalHeight);
        const w = img.naturalWidth * ratio, h = img.naturalHeight * ratio;
        if (i > 0) pdf.addPage();
        pdf.addImage(pages[i].url, "JPEG", (W - w) / 2, (H - h) / 2, w, h);
      }
      const blob = pdf.output("blob");
      const clean = (name.trim() || "scan.pdf").replace(/[\\/]/g, "");
      const finalName = clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
      await uploadFiles([new File([blob], finalName, { type: "application/pdf" })], { workspaceId: activeWorkspaceId, folderId });
      pages.forEach((p) => URL.revokeObjectURL(p.url));
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Génération impossible"); }
    finally { setBusy(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Scanner un document" className="animate-overlay fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-sheet-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl dark:bg-zinc-900" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-black tracking-tight">Scanner un document</h2>
          <button aria-label="Fermer" onClick={onClose} className="rounded-full p-2 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <p className="mt-1 text-xs text-stone-500">Photographiez chaque page avec la caméra arrière, réordonnez, générez le PDF.</p>
        <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <Button variant="outline" className="mt-3 w-full" onClick={() => input.current?.click()}><Camera size={16} /> {pages.length ? "Ajouter une page" : "Photographier la page 1"}</Button>

        {pages.length > 0 && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {pages.map((p, i) => (
                <div key={p.id} className="relative overflow-hidden rounded-xl border border-stone-200">
                  <img src={p.url} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-stone-900/80 px-1.5 py-0.5 text-[11px] font-bold text-white">{i + 1}</span>
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    <button aria-label="Monter" onClick={() => move(i, -1)} className="rounded bg-white/90 p-1"><ArrowUp size={13} /></button>
                    <button aria-label="Descendre" onClick={() => move(i, 1)} className="rounded bg-white/90 p-1"><ArrowDown size={13} /></button>
                    <button aria-label="Supprimer la page" onClick={() => setPages(pages.filter((x) => x.id !== p.id))} className="rounded bg-white/90 p-1 text-red-700"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
            <label className="mt-3 block text-sm font-medium">Nom du PDF
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800" />
            </label>
          </>
        )}
        {err && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button disabled={!pages.length || busy || !activeWorkspaceId} onClick={() => void generate()}>
            <FilePlus size={15} /> {busy ? "Génération…" : `Générer le PDF (${pages.length} p.)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
