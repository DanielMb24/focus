import fs from "fs";
import path from "path";
import type { Stats } from "fs";
import type { Readable } from "stream";
import type { StorageProvider } from "./types.js";

/** Stockage local (développement). Fichiers servis UNIQUEMENT via routes authentifiées. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private ready = false;
  constructor(private root: string) {}

  private ensureRoot(): void {
    if (this.ready) return;
    fs.mkdirSync(this.root, { recursive: true });
    this.ready = true;
  }

  private fullPath(key: string): string {
    const p = path.normalize(path.join(this.root, key));
    if (!p.startsWith(path.normalize(this.root + path.sep))) throw new Error("Invalid storage key");
    return p;
  }

  async store(tempPath: string, key: string): Promise<string> {
    try {
      this.ensureRoot();
    } catch {
      throw new Error("Stockage local indisponible (lecture seule ?). Sur Vercel : STORAGE_PROVIDER=gridfs + STORAGE_DIR=/tmp.");
    }
    const dest = this.fullPath(key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.rename(tempPath, dest);
    return key;
  }

  readStream(key: string, start?: number, end?: number): NodeJS.ReadableStream & Readable {
    return fs.createReadStream(this.fullPath(key), { start, end }) as NodeJS.ReadableStream & Readable;
  }

  stat(key: string): Promise<Stats> {
    return fs.promises.stat(this.fullPath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.promises.unlink(this.fullPath(key)).catch(() => null);
  }

  async copyFile(srcKey: string, destKey: string): Promise<void> {
    const dest = this.fullPath(destKey);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(this.fullPath(srcKey), dest);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.fullPath(key));
      return true;
    } catch {
      return false;
    }
  }
}
