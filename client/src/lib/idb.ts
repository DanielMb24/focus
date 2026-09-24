// Mini-wrapper IndexedDB : file d'uploads en attente + copies hors-ligne.
// Jamais de blobs dans Zustand/localStorage (§129).
const DB = "focus-files";
const STORES = ["pending-uploads", "offline-files"] as const;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: (typeof STORES)[number], mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export interface PendingUpload {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  workspaceId: string;
  folderId: string | null;
  links: { entityType: string; entityId: string }[];
  meta: { width?: number; height?: number; duration?: number; checksum?: string };
  retryCount: number;
  createdAt: number;
}

export const pendingUploads = {
  async add(p: PendingUpload): Promise<void> { await tx("pending-uploads", "readwrite", (s) => s.put(p)); },
  async all(): Promise<PendingUpload[]> { return tx("pending-uploads", "readonly", (s) => s.getAll()); },
  async remove(id: string): Promise<void> { await tx("pending-uploads", "readwrite", (s) => s.delete(id)); },
  async count(): Promise<number> { return tx("pending-uploads", "readonly", (s) => s.count()); },
};

export interface OfflineCopy { id: string; blob: Blob; mimeType: string; name: string; savedAt: number }

export const offlineFiles = {
  async save(c: OfflineCopy): Promise<void> { await tx("offline-files", "readwrite", (s) => s.put(c)); },
  async get(id: string): Promise<OfflineCopy | undefined> { return tx("offline-files", "readonly", (s) => s.get(id)); },
  async remove(id: string): Promise<void> { await tx("offline-files", "readwrite", (s) => s.delete(id)); },
  async has(id: string): Promise<boolean> { return (await this.get(id)) !== undefined; },
};
