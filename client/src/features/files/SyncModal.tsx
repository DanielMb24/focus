import { useEffect, useState } from "react";
import { X, FolderInput, RefreshCw, Trash2, ShieldCheck } from "lucide-react";
import { useWorkspace } from "../../store/ui";
import { useFolders, useCreateFolder, useUpdateFolder, useDeleteFolder, useUpdateFile, useTrashFile } from "../../lib/files";
import { uploadFiles } from "../../lib/upload";
import { api } from "../../lib/api";
import { supportsDirectoryPicker, supportsFileSystemAccess } from "../../lib/capabilities";
import {
  pickDirectory, ensurePermission, readLocalTree, diffTrees, syncRoots,
  type LocalEntry, type VirtualNode,
} from "../../lib/sync";
import { Button } from "../../components/ui/primitives";
import { formatSize } from "../../lib/fileutils";
import type { Folder, FileAsset } from "../../types.files";

type Step = "pick" | "scanning" | "review" | "applying" | "done";

/** Synchronisation explicite avec un dossier de l'appareil (§63-70, §110).
 *  Le web ne surveille jamais en arrière-plan : tout est comparé puis confirmé. */
export function SyncModal({ initialFolderId, onClose }: { initialFolderId: string | null; onClose: () => void }) {
  const { activeWorkspaceId } = useWorkspace();
  const { data: allFolders = [] } = useFolders(undefined);
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const updateFile = useUpdateFile();
  const trashFile = useTrashFile();

  const [step, setStep] = useState<Step>("pick");
  const [destId, setDestId] = useState<string | null>(initialFolderId);
  const [roots, setRoots] = useState<Awaited<ReturnType<typeof syncRoots.all>>>([]);
  const [err, setErr] = useState("");
  const [diff, setDiff] = useState<{ toUpload: LocalEntry[]; toRename: { local: LocalEntry; virtual: VirtualNode }[]; missingLocally: VirtualNode[] } | null>(null);
  const [toDelete, setToDelete] = useState<Set<string>>(new Set());
  const [applyRenames, setApplyRenames] = useState(true);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => { syncRoots.all().then(setRoots).catch(() => null); }, []);
  const supported = supportsDirectoryPicker() || supportsFileSystemAccess();

  function folderPath(id: string | null, map: Map<string, Folder>): string {
    const parts: string[] = [];
    let cur = id ? map.get(id) : undefined;
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? map.get(cur.parentId) : undefined;
    }
    return parts.join("/");
  }

  async function buildVirtual(scopeId: string | null): Promise<VirtualNode[]> {
    const map = new Map(allFolders.map((f) => [f._id, f]));
    const scopePath = scopeId ? folderPath(scopeId, map) : "";
    const nodes: VirtualNode[] = [];
    const inScope = (p: string) => (scopePath ? p === scopePath || p.startsWith(`${scopePath}/`) : true);
    for (const f of allFolders) {
      const p = folderPath(f._id, map);
      if (inScope(p)) nodes.push({ path: p, name: f.name, size: 0, mtime: new Date(f.updatedAt).getTime(), kind: "directory", id: f._id });
    }
    const files = await api<{ data: FileAsset[] } | FileAsset[]>(`/api/v1/files?workspaceId=${activeWorkspaceId}&limit=500`).then((d) => (Array.isArray(d) ? d : d.data ?? []));
    for (const fi of files) {
      const dir = fi.folderId ? folderPath(fi.folderId, map) : "";
      const p = dir ? `${dir}/${fi.name}` : fi.name;
      if (inScope(p)) nodes.push({ path: p, name: fi.name, size: fi.size, mtime: new Date(fi.updatedAt).getTime(), kind: "file", id: fi._id });
    }
    // Chemins relatifs au dossier synchronisé
    return nodes
      .map((n) => ({ ...n, path: scopePath && n.path.startsWith(`${scopePath}/`) ? n.path.slice(scopePath.length + 1) : n.path }))
      .filter((n) => n.path !== "");
  }

  async function analyze(handle: { values(): AsyncIterable<FileSystemHandle> }, scopeId: string | null, saveRoot: boolean, dirName: string) {
    if (!activeWorkspaceId) return;
    setErr(""); setStep("scanning"); setProgress("Lecture du dossier…");
    try {
      const local = await readLocalTree(handle as never);
      setProgress("Comparaison…");
      const virtual = await buildVirtual(scopeId);
      const d = diffTrees(local, virtual);
      setDiff(d);
      setToDelete(new Set());
      setStep("review");
      if (saveRoot) {
        await syncRoots.save({ id: `${activeWorkspaceId}:${scopeId ?? "root"}:${Date.now()}`, handle, dirName, workspaceId: activeWorkspaceId, folderId: scopeId, createdAt: Date.now() });
        syncRoots.all().then(setRoots).catch(() => null);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Analyse impossible"); setStep("pick"); }
  }

  async function startPick() {
    setErr("");
    try {
      const handle = await pickDirectory();
      await analyze(handle, destId, true, (handle as { name: string }).name);
    } catch (e) {
      if ((e as Error)?.message !== "UNSUPPORTED" && (e as Error)?.name !== "AbortError") {
        setErr(e instanceof Error ? e.message : "Sélection impossible");
      }
    }
  }

  async function resync(rootId: string) {
    const root = roots.find((r) => r.id === rootId);
    if (!root || !activeWorkspaceId) return;
    setErr("");
    const ok = await ensurePermission(root.handle as never, true);
    if (!ok) { setErr("Permission refusée — choisissez à nouveau le dossier."); return; }
    await analyze(root.handle as never, root.folderId, false, root.dirName);
  }

  async function ensureDir(relDir: string, scopeId: string | null): Promise<string | null> {
    if (!relDir || !activeWorkspaceId) return scopeId;
    const segs = relDir.split("/").filter(Boolean);
    let parent: string | null = scopeId;
    // Relecture fraîche à chaque niveau pour rester exact
    for (const seg of segs) {
      const list = await api<{ data: Folder[] } | Folder[]>(
        `/api/v1/folders?workspaceId=${activeWorkspaceId}&parentId=${parent ?? "root"}&limit=100`
      ).then((d) => (Array.isArray(d) ? d : d.data ?? []));
      const found = list.find((f) => f.name === seg);
      if (found) parent = found._id;
      else {
        const created = await createFolder.mutateAsync({ workspaceId: activeWorkspaceId as string, name: seg, parentId: parent });
        parent = (created as unknown as { folder: Folder }).folder._id;
      }
    }
    return parent;
  }

  async function apply() {
    if (!diff || !activeWorkspaceId) return;
    setStep("applying");
    let up = 0, ren = 0, del = 0;
    try {
      for (const l of diff.toUpload) {
        if (!l.getFile) continue;
        const dir = l.path.includes("/") ? l.path.slice(0, l.path.lastIndexOf("/")) : "";
        const fid = await ensureDir(dir, destId);
        const f = await l.getFile();
        setProgress(`Envoi ${l.name}…`);
        await uploadFiles([f], { workspaceId: activeWorkspaceId, folderId: fid });
        up++;
      }
      if (applyRenames) {
        for (const r of diff.toRename) {
          const base = r.local.path.includes("/") ? r.local.path.slice(r.local.path.lastIndexOf("/") + 1) : r.local.path;
          setProgress(`Renommage ${r.virtual.name}…`);
          if (r.virtual.kind === "file") await updateFile.mutateAsync({ id: r.virtual.id, name: base });
          else await updateFolder.mutateAsync({ id: r.virtual.id, name: base });
          ren++;
        }
      }
      for (const v of diff.missingLocally) {
        if (!toDelete.has(v.path)) continue;
        setProgress(`Suppression ${v.name}…`);
        if (v.kind === "file") await trashFile.mutateAsync(v.id);
        else await deleteFolder.mutateAsync(v.id);
        del++;
      }
      setResult(`${up} importé(s), ${ren} renommé(s), ${del} supprimé(s).`);
      setStep("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec de synchronisation");
      setStep("review");
    }
  }

  function toggleDelete(path: string) {
    setToDelete((s) => { const n = new Set(s); if (n.has(path)) n.delete(path); else n.add(path); return n; });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Synchroniser un dossier" className="animate-overlay fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-sheet-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl dark:bg-zinc-900" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight">Synchroniser un dossier</h2>
          <button aria-label="Fermer" onClick={onClose} className="rounded-full p-2 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>

        {step === "pick" && (
          <>
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-200">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              L'accès au dossier sert uniquement à comparer puis importer ce que vous validez. Rien n'est lu sans votre action, et jamais en arrière-plan.
            </p>
            <label className="mt-3 block text-sm font-medium">Dossier de destination dans Focus
              <select value={destId ?? ""} onChange={(e) => setDestId(e.target.value || null)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                <option value="">Racine (Mes fichiers)</option>
                {allFolders.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </label>
            {supported ? (
              <Button className="mt-3 w-full" onClick={() => void startPick()}><FolderInput size={15} /> Choisir un dossier sur l'appareil</Button>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-stone-300 p-3 text-center dark:border-zinc-700">
                <p className="text-xs text-stone-500">Votre navigateur ne permet pas la sélection de dossier — importez les fichiers manuellement.</p>
                <Button variant="outline" className="mt-2" onClick={onClose}>Aller à l'import</Button>
              </div>
            )}
            {err && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{err}</p>}
            {roots.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Dossiers suivis</p>
                {roots.filter((r) => r.workspaceId === activeWorkspaceId).map((r) => (
                  <div key={r.id} className="mt-1.5 flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm dark:border-zinc-700">
                    <span className="min-w-0 flex-1 truncate font-medium">{r.dirName}</span>
                    <button onClick={() => void resync(r.id)} className="rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-bold text-white">Resync</button>
                    <button aria-label="Ne plus suivre" onClick={() => syncRoots.remove(r.id).then(() => syncRoots.all().then(setRoots).catch(() => null))} className="p-1 text-stone-400 hover:text-red-700"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === "scanning" && <p className="py-10 text-center text-sm text-stone-500">{progress}</p>}

        {step === "review" && diff && (
          <>
            <div className="mt-3 space-y-3">
              <section>
                <p className="text-sm font-bold">À importer ({diff.toUpload.length})</p>
                {diff.toUpload.length === 0 && <p className="text-xs text-stone-500">Rien de nouveau.</p>}
                <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                  {diff.toUpload.map((l) => <p key={l.path} className="truncate rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs dark:bg-zinc-800">+ {l.path} <span className="text-stone-400">· {formatSize(l.size)}</span></p>)}
                </div>
              </section>
              <section>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={applyRenames} onChange={(e) => setApplyRenames(e.target.checked)} className="h-4 w-4 accent-blue-700" />
                  Renommages détectés ({diff.toRename.length})
                </label>
                <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
                  {diff.toRename.map((r) => <p key={r.virtual.path} className="truncate rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs dark:bg-amber-950">~ {r.virtual.path} → {r.local.path.split("/").pop()}</p>)}
                </div>
              </section>
              <section>
                <p className="text-sm font-bold">Absents du téléphone ({diff.missingLocally.length})</p>
                <p className="text-xs text-stone-500">Cochez pour supprimer aussi dans Focus, sinon ils sont conservés.</p>
                <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                  {diff.missingLocally.map((v) => (
                    <label key={v.path} className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs dark:border-zinc-700">
                      <input type="checkbox" checked={toDelete.has(v.path)} onChange={() => toggleDelete(v.path)} className="h-4 w-4 accent-red-700" />
                      <span className="min-w-0 flex-1 truncate">− {v.path}</span>
                    </label>
                  ))}
                  {diff.missingLocally.length === 0 && <p className="text-xs text-stone-500">Rien à signaler.</p>}
                </div>
              </section>
            </div>
            {err && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep("pick")}>Retour</Button>
              <Button onClick={() => void apply()}><RefreshCw size={15} /> Appliquer</Button>
            </div>
          </>
        )}

        {step === "applying" && <p className="py-10 text-center text-sm text-stone-500">{progress || "Application…"}</p>}
        {step === "done" && (
          <div className="py-6 text-center">
            <p className="font-black">Synchronisation terminée</p>
            <p className="mt-1 text-sm text-stone-500">{result}</p>
            <Button className="mt-4" onClick={onClose}>Fermer</Button>
          </div>
        )}
      </div>
    </div>
  );
}
