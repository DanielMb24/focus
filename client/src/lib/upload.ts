import { getAccessToken, API_BASE } from "./api";
import { useUploads } from "../store/uploads";
import { pendingUploads, type PendingUpload } from "./idb";
import { queryClient } from "./queryClient";

export interface UploadTarget {
  workspaceId: string;
  folderId?: string | null;
  links?: { entityType: string; entityId: string }[];
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Dimensions image / durée média / checksum — calculés côté client avant envoi. */
export async function extractMeta(file: File): Promise<PendingUpload["meta"]> {
  const meta: PendingUpload["meta"] = {};
  try {
    if (file.type.startsWith("image/")) {
      const bmp = await createImageBitmap(file).catch(() => null);
      if (bmp) { meta.width = bmp.width; meta.height = bmp.height; bmp.close(); }
    } else if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
      const url = URL.createObjectURL(file);
      try {
        meta.duration = await new Promise<number | undefined>((resolve) => {
          const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
          el.preload = "metadata";
          el.onloadedmetadata = () => resolve(el.duration);
          el.onerror = () => resolve(undefined);
          setTimeout(() => resolve(undefined), 4000);
          el.src = url;
        });
      } finally { URL.revokeObjectURL(url); }
    }
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    meta.checksum = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { /* métadonnées best-effort */ }
  return meta;
}

/** Envoi réel avec progression (XHR, seul moyen fiable du % upload). */
function postMultipart(files: { file: File; name: string }[], target: UploadTarget, metas: PendingUpload["meta"][], onProgress: (pct: number) => void): Promise<{ files: unknown[] }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("workspaceId", target.workspaceId);
    if (target.folderId) fd.append("folderId", target.folderId);
    if (target.links?.length) fd.append("links", JSON.stringify(target.links));
    fd.append("metas", JSON.stringify(Object.fromEntries(metas.map((m, i) => [i, m]))));
    files.forEach((f) => fd.append("files", f.file, f.name));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/v1/files`);
    xhr.withCredentials = true;
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as { success: boolean; data?: { files: unknown[] }; error?: { message: string } };
        if (xhr.status >= 200 && xhr.status < 300 && json.success) resolve(json.data as { files: unknown[] });
        else reject(new Error(json.error?.message ?? `Upload refusé (${xhr.status})`));
      } catch { reject(new Error(`Réponse inattendue (${xhr.status})`)); }
    };
    xhr.onerror = () => reject(new Error(navigator.onLine ? "Échec réseau pendant l'envoi" : "OFFLINE"));
    xhr.ontimeout = () => reject(new Error("Délai d'envoi dépassé"));
    xhr.send(fd);
  });
}

/** Envoie des fichiers : direct si en ligne, sinon mise en file IDB (§124-125). */
export async function uploadFiles(list: File[], target: UploadTarget): Promise<void> {
  const { upsert, patch } = useUploads.getState();
  const metas = await Promise.all(list.map(extractMeta));
  if (!navigator.onLine) {
    for (let i = 0; i < list.length; i++) {
      const id = uid();
      const p: PendingUpload = {
        id, blob: list[i], fileName: list[i].name, mimeType: list[i].type || "application/octet-stream",
        size: list[i].size, workspaceId: target.workspaceId, folderId: target.folderId ?? null,
        links: target.links ?? [], meta: metas[i], retryCount: 0, createdAt: Date.now(),
      };
      await pendingUploads.add(p);
      upsert({ id, name: p.fileName, size: p.size, progress: 0, status: "pending", pendingRef: id });
    }
    return;
  }
  const groupId = uid();
  const total = list.reduce((s, f) => s + f.size, 0);
  upsert({ id: groupId, name: list.length > 1 ? `${list.length} fichiers` : list[0].name, size: total, progress: 0, status: "uploading" });
  try {
    await postMultipart(list.map((file) => ({ file, name: file.name })), target, metas, (pct) => patch(groupId, { progress: pct }));
    patch(groupId, { progress: 100, status: "completed" });
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
    queryClient.invalidateQueries({ queryKey: ["quota"] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec";
    if (msg === "OFFLINE") {
      for (let i = 0; i < list.length; i++) {
        const id = uid();
        await pendingUploads.add({
          id, blob: list[i], fileName: list[i].name, mimeType: list[i].type || "application/octet-stream",
          size: list[i].size, workspaceId: target.workspaceId, folderId: target.folderId ?? null,
          links: target.links ?? [], meta: metas[i], retryCount: 0, createdAt: Date.now(),
        });
        upsert({ id, name: list[i].name, size: list[i].size, progress: 0, status: "pending", pendingRef: id });
      }
      useUploads.getState().remove(groupId);
    } else {
      patch(groupId, { status: "failed", error: msg });
    }
    throw e instanceof Error ? e : new Error(msg);
  }
}

/** Rejoue la file en attente au retour de la connexion (§87). */
export async function flushPendingUploads(): Promise<void> {
  if (!navigator.onLine) return;
  const { patch, remove } = useUploads.getState();
  const pendings = await pendingUploads.all();
  for (const p of pendings) {
    patch(p.id, { status: "uploading", progress: 0, error: undefined });
    try {
      const file = new File([p.blob], p.fileName, { type: p.mimeType });
      await postMultipart([{ file, name: p.fileName }], { workspaceId: p.workspaceId, folderId: p.folderId, links: p.links }, [p.meta], (pct) => patch(p.id, { progress: pct }));
      await pendingUploads.remove(p.id);
      patch(p.id, { progress: 100, status: "completed" });
    } catch {
      patch(p.id, { status: "failed", error: "Envoi impossible — réessayez." });
    }
  }
  queryClient.invalidateQueries({ queryKey: ["files"] });
  queryClient.invalidateQueries({ queryKey: ["quota"] });
}

/** Téléchargement authentifié (blob local, jamais d'URL publique). */
export async function downloadFile(fileId: string, name: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/v1/files/${fileId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error("Téléchargement impossible");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
