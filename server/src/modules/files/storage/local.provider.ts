import fs from "fs";
import path from "path";
import type { Stats } from "fs";
import type { Readable } from "stream";
import type { StorageProvider } from "./types.js";

/** Stockage local (développement). Fichiers servis UNIQUEMENT via routes authentifiées. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  constructor(private root: string) {
    fs.mkdirSync(this.root, { recursive: true });
  }

  private fullPath(key: string): string {
    const p = path.normalize(path.join(this.root, key));
    if (!p.startsWith(path.normalize(this.root + path.sep))) throw new Error("Invalid storage key");
    return p;
  }

  async store(tempPath: string, key: string): Promise<void> {
    const dest = this.fullPath(key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.rename(tempPath, dest);
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

  async exists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.fullPath(key));
      return true;
    } catch {
      return false;
    }
  }
}
