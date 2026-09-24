import path from "path";
import { fileURLToPath } from "url";
import { env } from "../../../config/env.js";
import { LocalStorageProvider } from "./local.provider.js";
import { GridFSStorageProvider } from "./gridfs.provider.js";
import type { StorageProvider } from "./types.js";

/** Résolu par rapport au dossier server/, quel que soit le cwd de lancement. */
export function storageDir(): string {
  if (path.isAbsolute(env.STORAGE_DIR)) return env.STORAGE_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../", env.STORAGE_DIR);
}

let provider: StorageProvider | null = null;

/** Point d'entrée unique. STORAGE_PROVIDER=local (défaut, dev) ou gridfs (serverless/Vercel). */
export function storage(): StorageProvider {
  if (!provider) {
    provider = env.STORAGE_PROVIDER === "gridfs" ? new GridFSStorageProvider() : new LocalStorageProvider(storageDir());
  }
  return provider;
}
