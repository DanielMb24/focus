import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { fileTypeFromFile } from "file-type";
import { env } from "../../config/env.js";
import { storageDir } from "./storage/index.js";
import { AppError } from "../../shared/errors.js";

/** Extensions et MIME acceptés (§75). SVG exclu (scripts embarquables). */
const ALLOWED: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword", "application/x-cfb", "application/octet-stream"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  xls: ["application/vnd.ms-excel", "application/x-cfb", "application/octet-stream"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
  ppt: ["application/vnd.ms-powerpoint", "application/x-cfb", "application/octet-stream"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"],
  txt: ["text/plain"],
  csv: ["text/csv", "text/plain", "application/vnd.ms-excel"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  zip: ["application/zip", "application/x-zip-compressed"],
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/x-wav", "audio/vnd.wave"],
  mp4: ["video/mp4"],
  webm: ["video/webm"],
};

export function extensionOf(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

export function sanitizeName(name: string): string {
  return name.replace(/[\\/]/g, "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || "fichier";
}

/** Clé interne opaque : jamais le nom utilisateur (§99). */
export function storageKey(workspaceId: string, ext: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${workspaceId}/${y}/${m}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
}

/** Dossier temporaire : STORAGE_DIR/tmp, avec repli sur l'OS (serverless : seul /tmp est inscriptible). */
function resolveTmpDir(): string {
  try {
    const dir = path.join(storageDir(), "tmp");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    const fallback = path.join(os.tmpdir(), "focus-uploads");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}
const tmpDir = resolveTmpDir();

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir),
    filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}.tmp`),
  }),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    if (!ALLOWED[ext]) return cb(new AppError(400, "VALIDATION_ERROR", `Type de fichier non supporté : .${ext}`));
    cb(null, true);
  },
});

/** Vérifie la cohérence extension ↔ MIME déclaré ↔ signature magique (file-type). */
export async function verifyFile(tempPath: string, originalName: string, declaredMime: string): Promise<{ ext: string; mime: string }> {
  const ext = extensionOf(originalName);
  const allowed = ALLOWED[ext];
  if (!allowed) throw new AppError(400, "VALIDATION_ERROR", `Type de fichier non supporté : .${ext}`);
  const detected = await fileTypeFromFile(tempPath).catch(() => undefined);
  if (detected) {
    const ok = allowed.includes(detected.mime) || detected.ext === ext || (ext === "jpg" && detected.ext === "jpg");
    // OOXML (docx/xlsx/pptx) parfois détecté comme zip : on accepte si le zip est attendu
    const zipOk = detected.ext === "zip" && allowed.includes("application/zip");
    if (!ok && !zipOk) {
      throw new AppError(400, "VALIDATION_ERROR", `Contenu incohérent avec l'extension .${ext} (détecté : ${detected.mime})`);
    }
    return { ext, mime: allowed.includes(detected.mime) ? detected.mime : allowed[0] };
  }
  // Pas de signature (txt, csv, legacy OLE) : on se fie à la cohérence extension/MIME déclaré
  if (!allowed.includes(declaredMime) && declaredMime !== "application/octet-stream") {
    throw new AppError(400, "VALIDATION_ERROR", `MIME incohérent pour .${ext} : ${declaredMime}`);
  }
  return { ext, mime: allowed[0] };
}

export function cleanupTemp(p: string): void {
  fs.unlink(p, () => null);
}
