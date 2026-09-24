import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Download, Share2, Star, Pencil, Trash2, RotateCcw, ChevronRight, WifiOff, Link2, X, Check } from "lucide-react";
import { useFileDetail, useFileBlob, useUpdateFile, useTrashFile, useRestoreFile, usePermanentDeleteFile, useLinkFile, useUnlinkFile } from "../lib/files";
import { API_BASE } from "../lib/api";
import { useTasks, useProjects, useNotes, useGoals } from "../lib/hooks";
import { downloadFile } from "../lib/upload";
import { supportsFileShare, supportsWebShare } from "../lib/capabilities";
import { offlineFiles } from "../lib/idb";
import { Topbar } from "../components/layout/Shell";
import { Card, Button, Skeleton, Badge } from "../components/ui/primitives";
import { formatSize, fileIcon } from "../lib/fileutils";
import type { EntityType } from "../types.files";
import { cn } from "../lib/cn";

const ENTITY_TYPES: { id: EntityType; label: string }[] = [
  { id: "task", label: "Tâche" }, { id: "project", label: "Projet" }, { id: "note", label: "Note" }, { id: "goal", label: "Objectif" },
];

export function FileDetail() {
  const { fileId } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError } = useFileDetail(fileId);
  const { data: blobUrl, isLoading: blobLoading, isError: blobError } = useFileBlob(fileId);
  const updateFile = useUpdateFile();
  const trashFile = useTrashFile();
  const restoreFile = useRestoreFile();
  const permanentDeleteFile = usePermanentDeleteFile();
  const linkFile = useLinkFile();
  const unlinkFile = useUnlinkFile();

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [offline, setOffline] = useState(false);
  const [linkType, setLinkType] = useState<EntityType>("task");
  const [linkId, setLinkId] = useState("");

  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const { data: notes = [] } = useNotes();
  const { data: goals = [] } = useGoals();

  useEffect(() => {
    if (fileId) void offlineFiles.has(fileId).then(setOffline).catch(() => null);
  }, [fileId]);

  if (isLoading) return <div><Topbar title="Fichier" /><Skeleton className="h-64" /></div>;
  if (isError || !data) return <div><Topbar title="Fichier introuvable" /><Button onClick={() => nav("/files")}>Retour aux fichiers</Button></div>;

  const file = data.file;
  const Icon = fileIcon(file.mimeType);
  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";
  const isText = file.mimeType.startsWith("text/");
  const isVideo = file.mimeType.startsWith("video/");
  const isAudio = file.mimeType.startsWith("audio/");

  async function doDownload() {
    try { await downloadFile(file._id, file.name); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Échec"); }
  }

  async function doShare() {
    setMsg("");
    try {
      if (!navigator.onLine) throw new Error("Hors ligne");
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API_BASE}/api/v1/files/${file._id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include",
      });
      if (!res.ok) throw new Error("Partage impossible");
      const blob = await res.blob();
      const shareFile = new File([blob], file.name, { type: file.mimeType });
      if (supportsFileShare([shareFile])) {
        await navigator.share({ files: [shareFile], title: file.name });
      } else if (supportsWebShare()) {
        await navigator.share({ title: file.name, text: `${file.name} (${formatSize(file.size)})` });
      } else {
        await navigator.clipboard?.writeText(`${window.location.origin}/files/${file._id}`);
        setMsg("Lien copié dans le presse-papiers.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setMsg(e instanceof Error ? e.message : "Échec");
    }
  }

  async function toggleOffline() {
    if (!fileId) return;
    try {
      if (offline) { await offlineFiles.remove(fileId); setOffline(false); }
      else {
        if (!blobUrl) throw new Error("Aperçu non chargé");
        const blob = await (await fetch(blobUrl)).blob();
        await offlineFiles.save({ id: fileId, blob, mimeType: file.mimeType, name: file.name, savedAt: Date.now() });
        setOffline(true);
      }
    } catch (e) { setMsg(e instanceof Error ? e.message : "Échec"); }
  }

  const candidates: Record<EntityType, { id: string; label: string }[]> = {
    task: tasks.slice(0, 50).map((t) => ({ id: t._id, label: t.title })),
    project: projects.map((p) => ({ id: p._id, label: String(p.name) })),
    note: notes.slice(0, 50).map((n) => ({ id: n._id, label: n.title })),
    goal: goals.map((g) => ({ id: g._id, label: g.title })),
  };

  return (
    <div>
      <Topbar title={file.name} subtitle={`${file.mimeType} · ${formatSize(file.size)}`} />
      {msg && <p role="status" className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">{msg}</p>}
      {!navigator.onLine && !offline && <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900"><WifiOff size={15} /> Hors ligne — aperçu indisponible (marquez-le « hors connexion »).</p>}

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="lg:col-span-2">
          <Card className="!p-0 overflow-hidden">
            <div className="flex min-h-64 items-center justify-center bg-stone-100 p-4 dark:bg-zinc-800">
              {blobLoading ? <Skeleton className="h-64 w-full" />
                : blobError || !blobUrl ? (
                  <div className="flex flex-col items-center py-10 text-stone-400">
                    <Icon size={48} />
                    <p className="mt-2 text-sm">{isImage || isPdf || isText || isVideo || isAudio ? "Aperçu indisponible" : "Pas d'aperçu pour ce format — téléchargez le fichier."}</p>
                  </div>
                ) : isImage ? <img src={blobUrl} alt={file.name} className="max-h-[60vh] rounded-lg object-contain" loading="lazy" />
                  : isPdf ? <iframe src={blobUrl} title={file.name} className="h-[60vh] w-full rounded-lg bg-white" />
                    : isVideo ? <video src={blobUrl} controls className="max-h-[60vh] w-full rounded-lg" preload="metadata" />
                      : isAudio ? <audio src={blobUrl} controls className="w-full" preload="metadata" />
                        : isText ? <TextPreview url={blobUrl} />
                          : <div className="flex flex-col items-center py-10 text-stone-400"><Icon size={48} /><p className="mt-2 text-sm">Téléchargez pour ouvrir ce format.</p></div>}
            </div>
          </Card>

          <Card className="mt-4">
            <h2 className="font-black tracking-tight">Associations</h2>
            <p className="text-xs text-stone-500">Le fichier n'est jamais dupliqué : seules des liaisons sont créées.</p>
            <div className="mt-2 space-y-1.5">
              {data.links.map((l) => (
                <div key={l._id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-zinc-700">
                  <Link2 size={14} className="text-stone-400" />
                  <Badge>{l.entityType}</Badge>
                  <EntityLinkLabel type={l.entityType} id={String(l.entityId)} />
                  <button aria-label="Dissocier" onClick={() => unlinkFile.mutate({ fileId: file._id, linkId: l._id })} className="ml-auto p-1 text-stone-400 hover:text-red-700"><X size={14} /></button>
                </div>
              ))}
              {data.links.length === 0 && <p className="text-sm text-stone-500">Aucune association.</p>}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select aria-label="Type d'élément" value={linkType} onChange={(e) => { setLinkType(e.target.value as EntityType); setLinkId(""); }} className="rounded-lg border border-stone-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                {ENTITY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <select aria-label="Élément à associer" value={linkId} onChange={(e) => setLinkId(e.target.value)} className="w-full rounded-lg border border-stone-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="">Choisir…</option>
                {candidates[linkType].map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <Button disabled={!linkId} onClick={() => linkFile.mutate({ fileId: file._id, entityType: linkType, entityId: linkId }, { onSuccess: () => setLinkId("") })}>Associer</Button>
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="font-black tracking-tight">Détails</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <Row k="Nom" v={file.name} />
              <Row k="Type" v={file.mimeType} />
              <Row k="Taille" v={formatSize(file.size)} />
              <Row k="Ajouté le" v={new Date(file.createdAt).toLocaleString("fr-FR")} />
              {file.metadata?.width ? <Row k="Dimensions" v={`${file.metadata.width} × ${file.metadata.height}px`} /> : null}
              {file.metadata?.duration ? <Row k="Durée" v={`${Math.round(file.metadata.duration)} s`} /> : null}
              {data.breadcrumb.length > 0 && (
                <div><dt className="text-xs text-stone-400">Dossier</dt>
                  <dd className="flex flex-wrap items-center gap-1 text-sm">
                    <Link to="/files" className="text-blue-700 hover:underline">Mes fichiers</Link>
                    {data.breadcrumb.map((b) => <span key={b._id} className="flex items-center gap-1"><ChevronRight size={12} className="text-stone-400" />{b.name}</span>)}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void doDownload()}><Download size={15} /> Télécharger</Button>
              <Button variant="outline" onClick={() => void doShare()}><Share2 size={15} /> Partager</Button>
            </div>
            <button onClick={() => void toggleOffline()} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-left text-sm hover:border-stone-400">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", offline ? "border-blue-700 bg-blue-700 text-white" : "border-stone-300")}>{offline && <Check size={13} strokeWidth={3} />}</span>
              Disponible hors connexion {offline ? "(activé)" : ""}
            </button>
          </Card>

          <Card className="mt-4">
            <h2 className="font-black tracking-tight">Gérer</h2>
            {renaming ? (
              <div className="mt-2">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Nouveau nom" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800" />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setRenaming(false)}>Annuler</Button>
                  <Button onClick={() => updateFile.mutate({ id: file._id, name: name.trim() }, { onSuccess: () => setRenaming(false) })}>Renommer</Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <ManageBtn icon={Pencil} label="Renommer" onClick={() => { setName(file.name); setRenaming(true); }} />
                <ManageBtn icon={Star} label={file.isFavorite ? "Retirer favori" : "Favori"} onClick={() => updateFile.mutate({ id: file._id, isFavorite: !file.isFavorite })} />
                {file.status === "trashed"
                  ? <ManageBtn icon={RotateCcw} label="Restaurer" onClick={() => restoreFile.mutate(file._id, { onSuccess: () => nav("/files") })} />
                  : <ManageBtn icon={Trash2} label="Supprimer" danger onClick={() => trashFile.mutate(file._id, { onSuccess: () => nav("/files") })} />}
                {file.status === "trashed" && (
                  <ManageBtn icon={Trash2} label="Définitif" danger onClick={() => { if (window.confirm("Supprimer définitivement ?")) permanentDeleteFile.mutate(file._id, { onSuccess: () => nav("/files") }); }} />
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs text-stone-400">{k}</dt><dd className="break-all text-sm font-medium">{v}</dd></div>;
}

function ManageBtn({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-2 py-2 text-sm font-medium transition hover:border-stone-400", danger && "text-red-700 hover:border-red-400")}>
      <Icon size={15} /> {label}
    </button>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    fetch(url).then((r) => r.text()).then((t) => setText(t.slice(0, 20000))).catch(() => setText(null));
  }, [url]);
  if (text === null) return <p className="py-8 text-sm text-stone-500">Chargement…</p>;
  return <pre className="max-h-[60vh] w-full overflow-auto whitespace-pre-wrap rounded-lg bg-white p-4 text-left text-sm dark:bg-zinc-900">{text}</pre>;
}

function EntityLinkLabel({ type, id }: { type: string; id: string }) {
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const { data: notes = [] } = useNotes();
  const { data: goals = [] } = useGoals();
  let label = id.slice(-6);
  if (type === "task") label = tasks.find((t) => t._id === id)?.title ?? label;
  if (type === "project") label = String(projects.find((p) => p._id === id)?.name ?? label);
  if (type === "note") label = notes.find((n) => n._id === id)?.title ?? label;
  if (type === "goal") label = goals.find((g) => g._id === id)?.title ?? label;
  const to = type === "project" ? `/projects/${id}` : type === "task" ? "/tasks" : type === "note" ? "/notes" : "/goals";
  return <Link to={to} className="truncate text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline">{label}</Link>;
}

