// Synchronisation honnête avec un dossier du téléphone/ordinateur :
// le web ne peut ni surveiller ni lire en arrière-plan — tout passe par une
// action explicite de l'utilisateur, comparaison, puis confirmation.
// Handles FileSystem persistés en IndexedDB pour resynchroniser sans re-choisir.
import { supportsDirectoryPicker } from "./capabilities";

export interface LocalEntry {
  path: string; // chemin relatif, ex. "Images/schema.png"
  name: string;
  size: number;
  mtime: number;
  kind: "file" | "directory";
  getFile?: () => Promise<File>;
}

interface DirHandleLike {
  name: string;
  values(): AsyncIterable<FileSystemHandle>;
  queryPermission?(o: { mode: string }): Promise<PermissionState>;
  requestPermission?(o: { mode: string }): Promise<PermissionState>;
}

const DB = "focus-files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SyncRoot {
  id: string;
  handle: unknown;
  dirName: string;
  workspaceId: string;
  folderId: string | null;
  createdAt: number;
}

export const syncRoots = {
  async all(): Promise<SyncRoot[]> {
    try {
      const db = await openDb();
      if (!db.objectStoreNames.contains("sync-roots")) { db.close(); return []; }
      return await new Promise<SyncRoot[]>((resolve, reject) => {
        const tx = db.transaction("sync-roots", "readonly");
        const req = tx.objectStore("sync-roots").getAll();
        req.onsuccess = () => resolve(req.result as SyncRoot[]);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    } catch {
      return [];
    }
  },
  async save(root: SyncRoot): Promise<void> {
    const db = await openDb();
    // Le store sync-roots est créé à la volée si absent (montée de version douce).
    if (!db.objectStoreNames.contains("sync-roots")) {
      db.close();
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(DB, 2);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains("sync-roots")) d.createObjectStore("sync-roots", { keyPath: "id" });
        };
        req.onsuccess = () => { req.result.close(); resolve(); };
        req.onerror = () => reject(req.error);
      });
      return this.save(root);
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync-roots", "readwrite");
      tx.objectStore("sync-roots").put(root as unknown as Record<string, unknown>);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },
  async remove(id: string): Promise<void> {
    const db = await openDb();
    if (!db.objectStoreNames.contains("sync-roots")) { db.close(); return; }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync-roots", "readwrite");
      tx.objectStore("sync-roots").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },
};

export async function pickDirectory(): Promise<DirHandleLike> {
  if (!supportsDirectoryPicker()) throw new Error("UNSUPPORTED");
  const dir = await (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandleLike> }).showDirectoryPicker({ mode: "readwrite" });
  return dir;
}

export async function ensurePermission(handle: DirHandleLike, ask = false): Promise<boolean> {
  try {
    if (typeof handle.queryPermission === "function") {
      const q = await handle.queryPermission({ mode: "readwrite" });
      if (q === "granted") return true;
      if (q === "denied" || !ask) return false;
    } else if (!ask) {
      return true;
    }
    if (typeof handle.requestPermission === "function") {
      return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

/** Lecture récursive : nom + taille + date (jamais de contenu inutile). */
export async function readLocalTree(handle: DirHandleLike, base = ""): Promise<LocalEntry[]> {
  const out: LocalEntry[] = [];
  for await (const entry of handle.values()) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.kind === "file") {
      const fh = entry as FileSystemFileHandle;
      try {
        const f = await fh.getFile();
        out.push({ path: rel, name: entry.name, size: f.size, mtime: f.lastModified, kind: "file", getFile: async () => f });
      } catch { /* fichier illisible : ignoré */ }
    } else if (entry.kind === "directory") {
      out.push({ path: rel, name: entry.name, size: 0, mtime: 0, kind: "directory" });
      out.push(...(await readLocalTree(entry as unknown as DirHandleLike, rel)));
    }
  }
  return out;
}

export interface VirtualNode { path: string; name: string; size: number; mtime: number; kind: "file" | "directory"; id: string }

export interface SyncDiff {
  toUpload: LocalEntry[];
  toRename: { local: LocalEntry; virtual: VirtualNode }[];
  missingLocally: VirtualNode[];
}

/** Diff local ↔ virtuel. Même taille + même date + nom différent = renommage probable. */
export function diffTrees(local: LocalEntry[], virtual: VirtualNode[]): SyncDiff {
  const vByPath = new Map(virtual.map((v) => [v.path, v]));
  const lByPath = new Map(local.filter((l) => l.kind === "file").map((l) => [l.path, l]));
  const toUpload: LocalEntry[] = [];
  const toRename: SyncDiff["toRename"] = [];
  const usedVirtual = new Set<string>();

  for (const l of local) {
    if (l.kind !== "file") continue;
    const v = vByPath.get(l.path);
    if (v && v.kind === "file") { usedVirtual.add(l.path); continue; }
    if (v) { usedVirtual.add(l.path); continue; }
    // Heuristique renommage : même taille + même date (±2s), nom différent, même dossier.
    const dir = l.path.includes("/") ? l.path.slice(0, l.path.lastIndexOf("/")) : "";
    const candidate = virtual.find(
      (x) => x.kind === "file" && !usedVirtual.has(x.path) && x.size === l.size && Math.abs(x.mtime - l.mtime) < 2000 &&
        (x.path.includes("/") ? x.path.slice(0, x.path.lastIndexOf("/")) : "") === dir
    );
    if (candidate) { usedVirtual.add(candidate.path); toRename.push({ local: l, virtual: candidate }); }
    else toUpload.push(l);
  }
  void lByPath;
  const missingLocally = virtual.filter((v) => !usedVirtual.has(v.path));
  return { toUpload, toRename, missingLocally };
}
