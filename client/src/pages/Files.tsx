import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Folder as FolderIcon, FileText, Star, Trash2, RotateCcw, ChevronRight, ChevronLeft, X,
  LayoutGrid, List as ListIcon, CheckSquare, Download, Share2, FolderPlus, Camera, FolderInput, ScanLine, WifiOff, HardDrive,
  Search, Plus, Upload,
} from "lucide-react";
import { useWorkspace } from "../store/ui";
import {
  useFolders, useFolder, useCreateFolder, useUpdateFolder, useDeleteFolder, useRestoreFolder,
  usePermanentDeleteFolder, useFolderTemplate, useFiles, useRecentFiles, useFavoriteFiles, useQuota,
  useUpdateFile, useTrashFile, useRestoreFile, usePermanentDeleteFile,
} from "../lib/files";
import { uploadFiles } from "../lib/upload";
import { supportsDirectoryPicker } from "../lib/capabilities";
import { Topbar } from "../components/layout/Shell";
import { Card, EmptyState, Button, Skeleton, Badge } from "../components/ui/primitives";
import { ScannerModal } from "../features/files/ScannerModal";
import { formatSize, fileIcon } from "../lib/fileutils";
import { useOutsideClose } from "../lib/outside";
import { cn } from "../lib/cn";
import type { Folder, FileAsset } from "../types.files";

type View = "files" | "recent" | "favorites" | "trash";

/** Types minimaux File System Access (hors lib.dom TS). */
interface FsDirHandle { name: string; values(): AsyncIterable<FileSystemHandle> }

export function Files() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { activeWorkspaceId } = useWorkspace();
  const [view, setView] = useState<View>("files");
  const [folderId, setFolderId] = useState<string | null>(() => params.get("folder"));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("newest");
  const [layout, setLayout] = useState<"grid" | "list">(() => (localStorage.getItem("files-layout") as "grid" | "list") ?? "list");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fabOpen, setFabOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [actionTarget, setActionTarget] = useState<{ kind: "file" | "folder"; id: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  useOutsideClose(fabOpen, fabRef, () => setFabOpen(false));

  const { data: folderDetail } = useFolder(view === "files" ? folderId : null);
  const { data: folders = [], isLoading: foldersLoading } = useFolders(view === "files" ? folderId : undefined, view === "trash" ? { trashed: true } : view === "favorites" ? { favorites: true } : undefined);
  const { data: files = [], isLoading: filesLoading } = useFiles(
    view === "recent" || view === "favorites" || view === "trash"
      ? { favorites: view === "favorites", trashed: view === "trash", search: search || undefined, type: type || undefined, sort }
      : { folderId, search: search || undefined, type: type || undefined, sort }
  );
  const { data: recent = [] } = useRecentFiles();
  const { data: favFiles = [] } = useFavoriteFiles();
  const { data: quota } = useQuota();

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const restoreFolder = useRestoreFolder();
  const permanentDeleteFolder = usePermanentDeleteFolder();
  const template = useFolderTemplate();
  const updateFile = useUpdateFile();
  const trashFile = useTrashFile();
  const restoreFile = useRestoreFile();
  const permanentDeleteFile = usePermanentDeleteFile();

  useEffect(() => { localStorage.setItem("files-layout", layout); }, [layout]);
  useEffect(() => { setSelected(new Set()); setSelectMode(false); }, [folderId, view]);

  const shownFiles = view === "recent" ? recent : view === "favorites" ? favFiles : files;
  const loading = foldersLoading || filesLoading;

  async function handleFiles(list: FileList | File[], folder?: string | null) {
    setUploadErr("");
    const arr = Array.from(list as unknown as File[]);
    if (!arr.length || !activeWorkspaceId) return;
    try {
      await uploadFiles(arr, { workspaceId: activeWorkspaceId, folderId: folder ?? (view === "files" ? folderId : null) });
    } catch (e) { setUploadErr(e instanceof Error ? e.message : "Échec de l'envoi"); }
  }

  /** Import d'un dossier complet via File System Access API (avec fallback webkitdirectory). */
  async function importDirectory() {
    setFabOpen(false);
    if (!activeWorkspaceId) return;
    try {
      const dir = await (window as unknown as { showDirectoryPicker(o: object): Promise<FsDirHandle> }).showDirectoryPicker({ mode: "read" });
      await importFsDirectory(dir, folderId, dir.name);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setUploadErr(e instanceof Error ? e.message : "Import impossible");
    }
  }

  async function importFsDirectory(handle: FsDirHandle, parentId: string | null, fallbackName: string): Promise<string | null> {
    if (!activeWorkspaceId) return null;
    const created = await createFolder.mutateAsync({ workspaceId: activeWorkspaceId, name: handle.name || fallbackName, parentId });
    const newId = (created as unknown as { folder: Folder }).folder._id;
    // Reproduction récursive de l'arborescence dans l'espace virtuel (§70)
    async function build(h: FsDirHandle, pid: string | null) {
      for await (const entry of h.values()) {
        if (entry.kind === "file") {
          const f = await (entry as FileSystemFileHandle).getFile();
          await uploadFiles([f], { workspaceId: activeWorkspaceId as string, folderId: pid });
        } else {
          const sub = await createFolder.mutateAsync({ workspaceId: activeWorkspaceId as string, name: entry.name, parentId: pid });
          await build(entry as unknown as FsDirHandle, (sub as unknown as { folder: Folder }).folder._id);
        }
      }
    }
    await build(handle, newId);
    return newId;
  }

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function batchTrash() {
    for (const id of selected) await trashFile.mutateAsync(id);
    setSelected(new Set()); setSelectMode(false);
  }
  async function batchFav() {
    for (const id of selected) {
      const f = shownFiles.find((x) => x._id === id);
      if (f) await updateFile.mutateAsync({ id, isFavorite: !f.isFavorite });
    }
    setSelected(new Set()); setSelectMode(false);
  }

  const crumbs = folderDetail?.breadcrumb ?? [];
  const pct = quota && quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;

  return (
    <div>
      <Topbar title="Fichiers" subtitle={view === "files" ? (crumbs.length ? crumbs.map((c) => c.name).join(" / ") : "Mes fichiers") : view === "recent" ? "Accès récents" : view === "favorites" ? "Favoris" : "Corbeille"} />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Colonne latérale desktop */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="space-y-0.5" aria-label="Vues fichiers">
            {([["files", "Mes fichiers"], ["recent", "Récents"], ["favorites", "Favoris"], ["trash", "Corbeille"]] as [View, string][]).map(([v, label]) => (
              <button key={v} onClick={() => { setView(v); if (v === "files") setFolderId(null); }}
                className={view === v ? "block w-full rounded-lg bg-stone-900 px-3 py-2 text-left text-sm font-medium text-white" : "block w-full rounded-lg px-3 py-2 text-left text-sm text-stone-600 hover:bg-stone-100"}>
                {label}
              </button>
            ))}
          </nav>
          {quota && (
            <div className="mt-4 rounded-xl border border-stone-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="flex items-center gap-1.5 text-xs font-bold"><HardDrive size={13} /> Stockage</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="progress-fill h-1.5 rounded-full" style={{ ["--w" as string]: `${pct}%`, width: `${pct}%` }} /></div>
              <p className="mt-1 text-xs text-stone-500">{formatSize(quota.used)} / {formatSize(quota.limit)}</p>
            </div>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          {/* Onglets mobile */}
          <div className="mb-3 flex gap-2 overflow-x-auto lg:hidden" role="tablist" aria-label="Vues fichiers">
            {([["files", "Fichiers"], ["recent", "Récents"], ["favorites", "Favoris"], ["trash", "Corbeille"]] as [View, string][]).map(([v, label]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); if (v === "files") setFolderId(null); }}
                className={view === v ? "shrink-0 rounded-full bg-stone-900 px-3.5 py-1.5 text-sm font-medium text-white" : "shrink-0 rounded-full bg-stone-200/60 px-3.5 py-1.5 text-sm text-stone-600"}>
                {label}
              </button>
            ))}
          </div>

          {/* Fil d'Ariane desktop + retour mobile */}
          {view === "files" && (
            <div className="mb-3 flex items-center gap-1 text-sm">
              {folderId && <button aria-label="Dossier parent" onClick={() => setFolderId(folderDetail?.folder.parentId ?? null)} className="rounded-lg p-1.5 hover:bg-stone-100 lg:hidden"><ChevronLeft size={18} /></button>}
              <button onClick={() => setFolderId(null)} className={cn("rounded px-1 font-medium hover:underline", !folderId && "font-black")}>Mes fichiers</button>
              {crumbs.map((c) => (
                <span key={c._id} className="flex items-center gap-1">
                  <ChevronRight size={14} className="text-stone-400" />
                  <FolderCrumb folderId={c._id} name={c.name} onNav={setFolderId} />
                </span>
              ))}
              {folderDetail && (
                <span className="flex items-center gap-1"><ChevronRight size={14} className="text-stone-400" /><span className="font-black">{folderDetail.folder.name}</span></span>
              )}
            </div>
          )}

          {/* Barre d'outils */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input aria-label="Rechercher dans mes fichiers" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, extension…" className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-900" />
            </div>
            <select aria-label="Filtrer par type" value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">Tous types</option><option value="document">Documents</option><option value="image">Images</option><option value="video">Vidéos</option><option value="audio">Audio</option><option value="archive">Archives</option>
            </select>
            <select aria-label="Trier" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="newest">Récents</option><option value="oldest">Anciens</option><option value="name">Nom</option><option value="size">Taille</option><option value="type">Type</option>
            </select>
            <button aria-label={layout === "grid" ? "Vue liste" : "Vue grille"} onClick={() => setLayout(layout === "grid" ? "list" : "grid")} className="rounded-lg border border-stone-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
              {layout === "grid" ? <ListIcon size={17} /> : <LayoutGrid size={17} />}
            </button>
            <button onClick={() => setSelectMode(!selectMode)} aria-pressed={selectMode} className={selectMode ? "rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white" : "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"}>
              <span className="flex items-center gap-1.5"><CheckSquare size={15} /> Sélection</span>
            </button>
          </div>

          {uploadErr && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{uploadErr}</p>}
          {!navigator.onLine && <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900"><WifiOff size={15} /> Hors ligne — les imports seront mis en file et envoyés à la reconnexion.</p>}

          {selected.size > 0 && (
            <div className="animate-pop mb-3 flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-sm text-white">
              <span className="font-bold">{selected.size} sélectionné(s)</span>
              <span className="flex-1" />
              <button onClick={batchFav} className="rounded px-2 py-1 hover:bg-white/10">Favoris</button>
              {view !== "trash" && <button onClick={batchTrash} className="rounded px-2 py-1 hover:bg-white/10">Supprimer</button>}
              <button onClick={() => { setSelected(new Set()); setSelectMode(false); }} aria-label="Annuler la sélection" className="rounded p-1 hover:bg-white/10"><X size={15} /></button>
            </div>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files); }}
            className={cn("rounded-2xl border-2 border-dashed p-1 transition", dragOver ? "border-blue-700 bg-blue-50/50" : "border-transparent")}
          >
            {loading ? <Skeleton className="h-40" /> : (
              <>
                {view === "files" && folders.length > 0 && (
                  <div className={cn("mb-2 grid gap-2", layout === "grid" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1")}>
                    {folders.map((f) => (
                      <FolderRow key={f._id} folder={f} layout={layout} selectMode={selectMode} selected={selected.has(f._id)}
                        onToggle={() => toggleSelect(f._id)}
                        onOpen={() => { setFolderId(f._id); setSearch(""); }}
                        onActions={() => setActionTarget({ kind: "folder", id: f._id })} />
                    ))}
                  </div>
                )}
                {shownFiles.length > 0 ? (
                  <div className={cn("grid gap-2", layout === "grid" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1")}>
                    {shownFiles.map((f) => (
                      <FileRow key={f._id} file={f} layout={layout} selectMode={selectMode} selected={selected.has(f._id)}
                        onToggle={() => toggleSelect(f._id)}
                        onOpen={() => nav(`/files/${f._id}`)}
                        onActions={() => setActionTarget({ kind: "file", id: f._id })} />
                    ))}
                  </div>
                ) : (
                  folders.length === 0 && (
                    <EmptyState title={view === "trash" ? "Corbeille vide" : "Aucun fichier ici"} hint={view === "files" ? "Importez vos premiers documents ou créez des dossiers." : "Rien à afficher dans cette vue."}
                      action={view === "files" && !search ? (
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button onClick={() => fileInput.current?.click()}><Upload size={15} /> Importer</Button>
                          <Button variant="outline" onClick={async () => { if (activeWorkspaceId) { await template.mutateAsync({ workspaceId: activeWorkspaceId }); } }}>Créer mes dossiers types</Button>
                        </div>
                      ) : undefined} />
                  )
                )}
              </>
            )}
          </div>
          <p className="mt-2 hidden text-xs text-stone-400 md:block">Astuce : déposez des fichiers directement dans cette zone.</p>
        </div>
      </div>

      {/* Inputs d'import */}
      <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={dirInput} type="file" multiple className="hidden" {...{ webkitdirectory: "" } as object} onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }} />

      {/* FAB menu */}
      <div ref={fabRef} className="fixed bottom-24 right-4 z-40 md:bottom-8 md:right-8">
        {fabOpen && (
          <div className="animate-pop mb-3 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lift dark:border-zinc-700 dark:bg-zinc-900">
            <FabItem icon={FolderPlus} label="Nouveau dossier" onClick={() => { setFabOpen(false); setShowNewFolder(true); }} />
            <FabItem icon={Upload} label="Importer fichiers" onClick={() => { setFabOpen(false); fileInput.current?.click(); }} />
            {supportsDirectoryPicker()
              ? <FabItem icon={FolderInput} label="Importer un dossier" onClick={() => void importDirectory()} />
              : <FabItem icon={FolderInput} label="Importer (sélection multiple)" onClick={() => { setFabOpen(false); dirInput.current?.click(); }} />}
            <FabItem icon={Camera} label="Prendre une photo" onClick={() => { setFabOpen(false); photoInput.current?.click(); }} />
            <FabItem icon={ScanLine} label="Scanner un document" onClick={() => { setFabOpen(false); setScannerOpen(true); }} />
          </div>
        )}
        <button aria-label={fabOpen ? "Fermer" : "Ajouter : dossier, import, photo, scan"} aria-expanded={fabOpen} onClick={() => setFabOpen(!fabOpen)}
          className="btn-press ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-lift hover:bg-blue-800">
          <Plus size={24} className={cn("transition-transform", fabOpen && "rotate-45")} />
        </button>
      </div>

      {showNewFolder && (
        <div role="dialog" aria-modal="true" aria-label="Nouveau dossier" className="animate-overlay fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 sm:items-center sm:p-4" onClick={() => setShowNewFolder(false)}>
          <div onClick={(e) => e.stopPropagation()} className="animate-sheet-up w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl dark:bg-zinc-900">
            <h2 className="font-black tracking-tight">Nouveau dossier</h2>
            <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim() && activeWorkspaceId) { void createFolder.mutateAsync({ workspaceId: activeWorkspaceId, name: newFolderName.trim(), parentId: folderId }).then(() => { setNewFolderName(""); setShowNewFolder(false); }); } }}
              placeholder="Nom du dossier…" aria-label="Nom du dossier"
              className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800" />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowNewFolder(false)}>Annuler</Button>
              <Button disabled={!newFolderName.trim() || !activeWorkspaceId} onClick={() => { if (activeWorkspaceId) void createFolder.mutateAsync({ workspaceId: activeWorkspaceId, name: newFolderName.trim(), parentId: folderId }).then(() => { setNewFolderName(""); setShowNewFolder(false); }); }}>Créer</Button>
            </div>
          </div>
        </div>
      )}

      {actionTarget && (
        <ActionSheet
          target={actionTarget}
          view={view}
          onClose={() => setActionTarget(null)}
          onOpenFile={(id) => { setActionTarget(null); nav(`/files/${id}`); }}
          onOpenFolder={(id) => { setActionTarget(null); setView("files"); setFolderId(id); }}
        />
      )}
      {scannerOpen && <ScannerModal folderId={view === "files" ? folderId : null} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}

function FolderCrumb({ folderId, name, onNav }: { folderId: string; name: string; onNav: (id: string | null) => void }) {
  return <button onClick={() => onNav(folderId)} className="rounded px-1 hover:underline">{name}</button>;
}

function FabItem({ icon: Icon, label, onClick }: { icon: typeof Upload; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-stone-50 dark:hover:bg-zinc-800">
      <Icon size={17} className="text-stone-500" /> {label}
    </button>
  );
}

function FolderRow({ folder, layout, selectMode, selected, onToggle, onOpen, onActions }: {
  folder: Folder; layout: "grid" | "list"; selectMode: boolean; selected: boolean; onToggle: () => void; onOpen: () => void; onActions: () => void;
}) {
  return (
    <div className={cn("task-row group flex items-center gap-3 rounded-xl border bg-white px-3.5 py-3 shadow-subtle dark:bg-zinc-900", selected ? "border-blue-700" : "border-stone-200 dark:border-zinc-800")}>
      {selectMode && <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Sélectionner ${folder.name}`} className="h-4 w-4 accent-blue-700" />}
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Ouvrir ${folder.name}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <FolderIcon size={20} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{folder.name}</span>
          <span className="block text-xs text-stone-500">{folder.isFavorite ? "★ Favori · " : ""}Dossier{layout === "list" ? ` · modifié ${formatDistanceToNow(new Date(folder.updatedAt), { addSuffix: true, locale: fr })}` : ""}</span>
        </span>
      </button>
      <button aria-label={`Actions pour ${folder.name}`} onClick={onActions} className="rounded-lg px-2 py-1 font-black text-stone-400 hover:bg-stone-100">⋯</button>
    </div>
  );
}

function FileRow({ file, layout, selectMode, selected, onToggle, onOpen, onActions }: {
  file: FileAsset; layout: "grid" | "list"; selectMode: boolean; selected: boolean; onToggle: () => void; onOpen: () => void; onActions: () => void;
}) {
  const Icon = fileIcon(file.mimeType);
  return (
    <div className={cn("task-row group flex items-center gap-3 rounded-xl border bg-white px-3.5 py-3 shadow-subtle dark:bg-zinc-900", selected ? "border-blue-700" : "border-stone-200 dark:border-zinc-800")}>
      {selectMode && <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Sélectionner ${file.name}`} className="h-4 w-4 shrink-0 accent-blue-700" />}
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Ouvrir ${file.name}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <Icon size={20} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{file.name}</span>
          <span className="block truncate text-xs text-stone-500">
            {file.isFavorite ? "★ " : ""}{formatSize(file.size)}{layout === "list" ? ` · ${formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true, locale: fr })}` : ""}
          </span>
        </span>
      </button>
      <button aria-label={`Actions pour ${file.name}`} onClick={onActions} className="shrink-0 rounded-lg px-2 py-1 font-black text-stone-400 hover:bg-stone-100">⋯</button>
    </div>
  );
}

/** Bottom sheet d'actions (mobile) utilisable aussi sur desktop. */
function ActionSheet({ target, view, onClose, onOpenFile, onOpenFolder }: {
  target: { kind: "file" | "folder"; id: string }; view: View;
  onClose: () => void; onOpenFile: (id: string) => void; onOpenFolder: (id: string) => void;
}) {
  const { activeWorkspaceId } = useWorkspace();
  const { data: folders = [] } = useFolders(undefined);
  const updateFile = useUpdateFile();
  const trashFile = useTrashFile();
  const restoreFile = useRestoreFile();
  const permanentDeleteFile = usePermanentDeleteFile();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const restoreFolder = useRestoreFolder();
  const permanentDeleteFolder = usePermanentDeleteFolder();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [moving, setMoving] = useState(false);
  const [dest, setDest] = useState("");

  async function saveRename() {
    if (!name.trim()) return;
    if (target.kind === "file") await updateFile.mutateAsync({ id: target.id, name: name.trim() });
    else await updateFolder.mutateAsync({ id: target.id, name: name.trim() });
    onClose();
  }
  async function saveMove() {
    if (target.kind === "file") await updateFile.mutateAsync({ id: target.id, folderId: dest || null });
    else {
      if (dest === target.id) return;
      await updateFolder.mutateAsync({ id: target.id, parentId: dest || null });
    }
    onClose();
  }
  async function doDelete() {
    if (target.kind === "file") {
      if (view === "trash") { if (window.confirm("Supprimer définitivement ?")) { await permanentDeleteFile.mutateAsync(target.id); onClose(); } }
      else { await trashFile.mutateAsync(target.id); onClose(); }
    } else {
      if (view === "trash") { if (window.confirm("Supprimer définitivement ce dossier et son contenu ?")) { await permanentDeleteFolder.mutateAsync(target.id); onClose(); } }
      else { await deleteFolder.mutateAsync(target.id); onClose(); }
    }
  }
  async function doRestore() {
    if (target.kind === "file") await restoreFile.mutateAsync(target.id);
    else await restoreFolder.mutateAsync(target.id);
    onClose();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Actions" className="animate-overlay fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-sheet-up w-full max-w-sm rounded-t-2xl bg-white p-2 shadow-lift sm:rounded-2xl dark:bg-zinc-900" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {target.kind === "file"
          ? <SheetBtn icon={FileText} label="Ouvrir / Aperçu" onClick={() => onOpenFile(target.id)} />
          : <SheetBtn icon={FolderIcon} label="Ouvrir" onClick={() => onOpenFolder(target.id)} />}
        {view === "trash"
          ? <SheetBtn icon={RotateCcw} label="Restaurer" onClick={() => void doRestore()} />
          : <SheetBtn icon={Star} label="Basculer favori" onClick={() => { void (target.kind === "file" ? updateFile.mutateAsync({ id: target.id, isFavorite: true }).then(onClose) : updateFolder.mutateAsync({ id: target.id, isFavorite: true }).then(onClose)); }} />}
        {!renaming && !moving && (
          <>
            <SheetBtn icon={FileText} label="Renommer" onClick={() => setRenaming(true)} />
            {view !== "trash" && <SheetBtn icon={FolderIcon} label="Déplacer" onClick={() => setMoving(true)} />}
            <SheetBtn icon={Trash2} label={view === "trash" ? "Supprimer définitivement" : "Supprimer"} danger onClick={() => void doDelete()} />
          </>
        )}
        {renaming && (
          <div className="p-3">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau nom…" aria-label="Nouveau nom" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800" />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenaming(false)}>Annuler</Button>
              <Button onClick={() => void saveRename()}>Renommer</Button>
            </div>
          </div>
        )}
        {moving && (
          <div className="p-3">
            <label className="text-sm font-medium">Destination
              <select value={dest} onChange={(e) => setDest(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                <option value="">Racine (Mes fichiers)</option>
                {folders.filter((f) => f._id !== target.id).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMoving(false)}>Annuler</Button>
              <Button onClick={() => void saveMove()}>Déplacer</Button>
            </div>
          </div>
        )}
        <button onClick={onClose} className="mt-1 w-full rounded-xl bg-stone-100 py-3 text-sm font-bold dark:bg-zinc-800">Fermer</button>
      </div>
    </div>
  );
}

function SheetBtn({ icon: Icon, label, onClick, danger }: { icon: typeof FileText; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition hover:bg-stone-50 dark:hover:bg-zinc-800", danger && "text-red-700")}>
      <Icon size={17} className={danger ? "" : "text-stone-500"} /> {label}
    </button>
  );
}
