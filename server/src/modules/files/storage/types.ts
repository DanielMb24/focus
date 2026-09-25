import type { Stats } from "fs";
import type { Readable } from "stream";

/** Abstraction du stockage binaire. Le métier ne connaît que cette interface. */
export interface StorageProvider {
  readonly name: string;
  /** Stocke un fichier temporaire, retourne la clé finale (opaque). */
  store(tempPath: string, keyHint: string): Promise<string>;
  /** Flux de lecture (optionnellement partiel pour le streaming). */
  readStream(key: string, start?: number, end?: number): NodeJS.ReadableStream & Readable;
  stat(key: string): Promise<Stats>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Duplique un binaire (copier, jamais de partage de blob entre deux fichiers). */
  copyFile(srcKey: string, destKey: string): Promise<void>;
}

/* L'implémentation S3 (AWS / R2 / MinIO) viendra ici :
   export class S3StorageProvider implements StorageProvider { ... }
   avec URLs signées courte durée pour download/preview. */
