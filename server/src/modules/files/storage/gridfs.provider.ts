import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import type { Stats } from "fs";
import type { Readable } from "stream";
import type { StorageProvider } from "./types.js";

/**
 * Stockage GridFS (MongoDB/Atlas) : les binaires persistent en serverless
 * (Vercel), contrairement au disque éphémère. `storageKey` = ObjectId GridFS.
 */
export class GridFSStorageProvider implements StorageProvider {
  readonly name = "gridfs";

  private bucket(): GridFSBucket {
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB not connected");
    return new GridFSBucket(db, { bucketName: "fileAssets" });
  }

  async store(tempPath: string, _keyHint: string): Promise<string> {
    const { createReadStream, promises: fs } = await import("fs");
    const id = new ObjectId();
    await new Promise<void>((resolve, reject) => {
      const up = this.bucket().openUploadStreamWithId(id, id.toHexString());
      createReadStream(tempPath).pipe(up).on("error", reject).on("finish", () => resolve());
    });
    await fs.unlink(tempPath).catch(() => null);
    return id.toHexString();
  }

  readStream(key: string, start?: number, end?: number): NodeJS.ReadableStream & Readable {
    const id = new ObjectId(key);
    const stream =
      start !== undefined || end !== undefined
        // end HTTP (inclusif) → end driver (exclusif)
        ? this.bucket().openDownloadStream(id, { start, end: end !== undefined ? end + 1 : undefined })
        : this.bucket().openDownloadStream(id);
    return stream as unknown as NodeJS.ReadableStream & Readable;
  }

  async stat(key: string): Promise<Stats> {
    const doc = await this.bucket().find({ _id: new ObjectId(key) }).next();
    if (!doc) throw new Error("File not found");
    return { size: doc.length } as Stats;
  }

  async delete(key: string): Promise<void> {
    await this.bucket().delete(new ObjectId(key)).catch(() => null);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const doc = await this.bucket().find({ _id: new ObjectId(key) }).next();
      return !!doc;
    } catch {
      return false;
    }
  }
}
