import { useRef, useState } from "react";
import { Paperclip, X, Upload, Plus } from "lucide-react";
import { useWorkspace } from "../../store/ui";
import { useEntityFiles, useLinkFile, useUnlinkFile, useFiles } from "../../lib/files";
import { uploadFiles } from "../../lib/upload";
import { Button } from "../../components/ui/primitives";
import { formatSize, fileIcon } from "../../lib/fileutils";
import type { EntityType } from "../../types.files";

/** Pièces jointes d'une tâche / projet / note / objectif : liaison sans duplication (§77). */
export function AttachFiles({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { activeWorkspaceId } = useWorkspace();
  const { data } = useEntityFiles(entityType, entityId);
  const { data: allFiles = [] } = useFiles({});
  const linkFile = useLinkFile();
  const unlinkFile = useUnlinkFile();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const linkedIds = new Set((data?.links ?? []).map((l) => String(l.fileId)));
  const candidates = allFiles.filter((f) => !linkedIds.has(f._id) && (!q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 20);

  async function importNew(list: FileList | null) {
    if (!list?.length || !activeWorkspaceId) return;
    setErr("");
    try {
      await uploadFiles(Array.from(list), { workspaceId: activeWorkspaceId, links: [{ entityType, entityId }] });
    } catch (e) { setErr(e instanceof Error ? e.message : "Échec"); }
  }

  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-sm font-bold"><Paperclip size={14} /> Pièces jointes ({data?.files.length ?? 0})</p>
      <div className="mt-1.5 space-y-1.5">
        {(data?.files ?? []).map((f) => {
          const Icon = fileIcon(f.mimeType);
          const link = data?.links.find((l) => String(l.fileId) === f._id);
          return (
            <div key={f._id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm dark:border-zinc-700">
              <Icon size={15} className="shrink-0 text-stone-400" />
              <span className="block min-w-0 flex-1 truncate">{f.name} <span className="text-xs text-stone-400">· {formatSize(f.size)}</span></span>
              {link && <button aria-label="Dissocier" onClick={() => unlinkFile.mutate({ fileId: f._id, linkId: link._id })} className="p-1 text-stone-400 hover:text-red-700"><X size={14} /></button>}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={() => setPicking(!picking)}><Plus size={14} /> Lier un fichier</Button>
        <Button variant="outline" onClick={() => input.current?.click()}><Upload size={14} /> Importer</Button>
      </div>
      <input ref={input} type="file" multiple className="hidden" onChange={(e) => { void importNew(e.target.files); e.target.value = ""; }} />
      {err && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{err}</p>}
      {picking && (
        <div className="animate-fade-up mt-2 rounded-xl border border-stone-200 p-2.5 dark:border-zinc-700">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un fichier de l'espace…" aria-label="Rechercher un fichier" className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-600 dark:border-zinc-700 dark:bg-zinc-800" />
          <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto">
            {candidates.map((f) => (
              <button key={f._id} onClick={() => linkFile.mutate({ fileId: f._id, entityType, entityId }, { onSuccess: () => setPicking(false) })} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-zinc-800">
                {f.name} <span className="text-xs text-stone-400">· {formatSize(f.size)}</span>
              </button>
            ))}
            {candidates.length === 0 && <p className="px-2 py-3 text-center text-xs text-stone-500">Aucun fichier disponible.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
