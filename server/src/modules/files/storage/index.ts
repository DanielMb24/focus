import path from "path";
import { fileURLToPath } from "url";
import { env } from "../../../config/env.js";
import { LocalStorageProvider } from "./local.provider.js";
import type { StorageProvider } from "./types.js";

/** Résolu par rapport au dossier server/, quel que soit le cwd de lancement. */
export function storageDir(): string {
  if (path.isAbsolute(env.STORAGE_DIR)) return env.STORAGE_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../", env.STORAGE_DIR);
}

let provider: StorageProvider | null = null;

/** Point d'entrée unique. Pour S3/R2/MinIO : brancher ici selon STORAGE_PROVIDER. */
export function storage(): StorageProvider {
  if (!provider) provider = new LocalStorageProvider(storageDir());
  return provider;
}
