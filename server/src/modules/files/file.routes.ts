import { Router } from "express";
import { z } from "zod";
import { FileAssetModel, FileLinkModel, UploadSessionModel, LINKABLE_ENTITIES } from "./file.model.js";
import { FolderModel } from "./folder.model.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { ok, paginated, notFound, forbidden, AppError } from "../../shared/errors.js";
import { Response, NextFunction } from "express";
import { requireWorkspaceAccess } from "../workspaces/workspace.access.js";
import { storage } from "./storage/index.js";
import { upload, verifyFile, sanitizeName, storageKey, extensionOf, cleanupTemp } from "./upload.js";
import { env } from "../../config/env.js";
import { TaskModel } from "../tasks/task.model.js";
import { ProjectModel } from "../projects/project.model.js";
import { GoalModel, NoteModel } from "../users/extra.models.js";

export const fileRouter = Router();
fileRouter.use(requireAuth);

async function loadFile(req: AuthRequest, id: string, allowTrashed = true) {
  const f = await FileAssetModel.findById(id);
  if (!f || (!allowTrashed && f.status === "trashed")) throw notFound("File not found");
  await requireWorkspaceAccess(req.userId as string, String(f.workspaceId));
  return f;
}

const TYPE_FILTERS: Record<string, { mime?: RegExp; ext?: string[] }> = {
  document: { mime: /^(application|text)\//, ext: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"] },
  image: { mime: /^image\// },
  video: { mime: /^video\// },
  audio: { mime: /^audio\// },
  archive: { ext: ["zip"] },
};

/** GET /files — organisation, recherche, filtres, tri */
fileRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    if (!q["workspaceId"]) throw forbidden("workspaceId required");
    await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const filter: Record<string, unknown> = { workspaceId: q["workspaceId"] };
    if (q["trashed"] === "true") filter["status"] = "trashed";
    else filter["status"] = { $ne: "trashed" };
    if (q["folderId"] !== undefined && q["folderId"] !== "") {
      filter["folderId"] = q["folderId"] === "root" ? null : q["folderId"];
    }
    if (q["favorites"] === "true") filter["isFavorite"] = true;
    if (q["search"]) filter["name"] = { $regex: q["search"].slice(0, 80), $options: "i" };
    if (q["type"] && TYPE_FILTERS[q["type"]]) {
      const t = TYPE_FILTERS[q["type"]];
      const or: Record<string, unknown>[] = [];
      if (t.mime) or.push({ mimeType: t.mime });
      if (t.ext) or.push({ extension: { $in: t.ext } });
      filter["$or"] = or;
    }
    const sorts: Record<string, Record<string, 1 | -1>> = {
      name: { name: 1 }, newest: { updatedAt: -1 }, oldest: { updatedAt: 1 },
      size: { size: -1 }, type: { mimeType: 1 },
    };
    const sort = sorts[q["sort"] ?? "newest"] ?? sorts["newest"];
    const p = Math.max(1, Number(q["page"] ?? 1)), l = Math.min(100, Math.max(1, Number(q["limit"] ?? 50)));
    const total = await FileAssetModel.countDocuments(filter);
    const items = await FileAssetModel.find(filter).sort(sort).skip((p - 1) * l).limit(l).lean();
    res.json(paginated(items, p, l, total));
  } catch (e) { next(e); }
});

/** GET /files/recent — accès récents */
fileRouter.get("/recent", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    if (!q["workspaceId"]) throw forbidden("workspaceId required");
    await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const items = await FileAssetModel.find({ workspaceId: q["workspaceId"], status: { $ne: "trashed" } })
      .sort({ updatedAt: -1 }).limit(20).lean();
    res.json(ok({ files: items }));
  } catch (e) { next(e); }
});

/** GET /files/favorites */
fileRouter.get("/favorites", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    if (!q["workspaceId"]) throw forbidden("workspaceId required");
    await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const items = await FileAssetModel.find({ workspaceId: q["workspaceId"], status: { $ne: "trashed" }, isFavorite: true })
      .sort({ updatedAt: -1 }).limit(100).lean();
    res.json(ok({ files: items }));
  } catch (e) { next(e); }
});

/** GET /files/by-entity — pièces jointes d'une tâche/projet/note/objectif */
fileRouter.get("/by-entity", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    if (!q["workspaceId"] || !q["entityType"] || !q["entityId"]) throw forbidden("workspaceId, entityType, entityId required");
    await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const links = await FileLinkModel.find({ workspaceId: q["workspaceId"], entityType: q["entityType"], entityId: q["entityId"] }).lean();
    const files = await FileAssetModel.find({ _id: { $in: links.map((l) => l.fileId) }, status: { $ne: "trashed" } }).lean();
    res.json(ok({ files, links }));
  } catch (e) { next(e); }
});

/** GET /files/quota — utilisation du stockage */
fileRouter.get("/quota", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    if (!q["workspaceId"]) throw forbidden("workspaceId required");
    await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const agg = await FileAssetModel.aggregate([
      { $match: { workspaceId: (await import("mongoose")).default.Types.ObjectId.createFromHexString(q["workspaceId"]), status: { $ne: "trashed" } } },
      { $group: { _id: null, used: { $sum: "$size" }, count: { $sum: 1 } } },
    ]);
    const used = agg[0]?.used ?? 0;
    const limit = env.MAX_WORKSPACE_STORAGE_MB * 1024 * 1024;
    res.json(ok({ quota: { used, limit, count: agg[0]?.count ?? 0 } }));
  } catch (e) { next(e); }
});

async function assertEntity(workspaceId: string, entityType: string, entityId: string, userId: string) {
  if (entityType === "task") {
    const t = await TaskModel.findById(entityId);
    if (!t || t.createdBy.toString() !== userId) throw notFound("Linked task not found");
  } else if (entityType === "project") {
    const p = await ProjectModel.findById(entityId);
    if (!p) throw notFound("Linked project not found");
    await requireWorkspaceAccess(userId, String(p.workspaceId));
  } else if (entityType === "note") {
    const n = await NoteModel.findById(entityId);
    if (!n || n.createdBy.toString() !== userId) throw notFound("Linked note not found");
  } else if (entityType === "goal") {
    const g = await GoalModel.findById(entityId);
    if (!g || g.createdBy.toString() !== userId) throw notFound("Linked goal not found");
  }
}

/** POST /files — import réel (multipart, max 10 fichiers) */
fileRouter.post("/", upload.array("files", 10), async (req: AuthRequest, res: Response, next: NextFunction) => {
  const saved: string[] = [];
  try {
    const bodySchema = z.object({
      workspaceId: z.string().min(1),
      folderId: z.string().optional().nullable(),
      links: z.string().optional(),
      metas: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);
    await requireWorkspaceAccess(req.userId as string, body.workspaceId);
    const files = (req.files ?? []) as Express.Multer.File[];
    if (!files.length) throw new AppError(400, "VALIDATION_ERROR", "No file received");

    let folder: unknown = null;
    if (body.folderId) {
      folder = await FolderModel.findById(body.folderId);
      if (!folder || String((folder as { workspaceId: unknown }).workspaceId) !== body.workspaceId) throw notFound("Folder not found");
    }
    let links: { entityType: string; entityId: string }[] = [];
    if (body.links) {
      const parsed = z.array(z.object({ entityType: z.enum(["task", "project", "note", "goal"]), entityId: z.string() })).parse(JSON.parse(body.links));
      links = parsed;
      for (const l of links) await assertEntity(body.workspaceId, l.entityType, l.entityId, req.userId as string);
    }
    let metas: Record<string, { width?: number; height?: number; duration?: number; checksum?: string }> = {};
    if (body.metas) {
      try { metas = JSON.parse(body.metas) as typeof metas; } catch { metas = {}; }
    }

    const quota = await FileAssetModel.aggregate([
      { $match: { workspaceId: (await import("mongoose")).default.Types.ObjectId.createFromHexString(body.workspaceId), status: { $ne: "trashed" } } },
      { $group: { _id: null, used: { $sum: "$size" } } },
    ]);
    const used = quota[0]?.used ?? 0;
    const incoming = files.reduce((s, f) => s + f.size, 0);
    if (used + incoming > env.MAX_WORKSPACE_STORAGE_MB * 1024 * 1024) {
      throw new AppError(400, "VALIDATION_ERROR", "Quota de stockage de l'espace dépassé");
    }

    const created = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const { ext, mime } = await verifyFile(f.path, f.originalname, f.mimetype);
        const key = storageKey(body.workspaceId, ext);
        const finalKey = await storage().store(f.path, key);
        saved.push(finalKey);
        const meta = metas[String(i)] ?? {};
        const doc = await FileAssetModel.create({
          workspaceId: body.workspaceId,
          folderId: body.folderId || null,
          uploadedBy: req.userId,
          name: sanitizeName(f.originalname),
          originalName: f.originalname.slice(0, 200),
          extension: ext || extensionOf(f.originalname),
          mimeType: mime,
          size: f.size,
          storageKey: finalKey,
          storageProvider: storage().name,
          checksum: meta.checksum,
          status: "ready",
          metadata: { width: meta.width, height: meta.height, duration: meta.duration },
        });
        for (const l of links) {
          await FileLinkModel.updateOne(
            { fileId: doc._id, entityType: l.entityType, entityId: l.entityId },
            { $setOnInsert: { workspaceId: body.workspaceId, createdBy: req.userId } },
            { upsert: true }
          );
        }
        await UploadSessionModel.create({ workspaceId: body.workspaceId, createdBy: req.userId, fileName: f.originalname.slice(0, 200), size: f.size, mimeType: mime, status: "completed", fileId: doc._id });
        created.push(doc);
      } catch (e) {
        cleanupTemp(f.path);
        throw e;
      }
    }
    res.status(201).json(ok({ files: created }));
  } catch (e) {
    for (const k of saved) await storage().delete(k).catch(() => null);
    next(e);
  }
});

/** GET /files/:id — métadonnées + liaisons + fil d'Ariane */
fileRouter.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFile(req, req.params.id);
    const links = await FileLinkModel.find({ fileId: f._id }).lean();
    const breadcrumb: { _id: string; name: string }[] = [];
    let cursor = f.folderId ? await FolderModel.findById(String(f.folderId)).lean() : null;
    while (cursor) {
      breadcrumb.unshift({ _id: String(cursor._id), name: cursor.name as string });
      cursor = cursor.parentId ? await FolderModel.findById(String(cursor.parentId)).lean() : null;
    }
    res.json(ok({ file: f, links, breadcrumb }));
  } catch (e) { next(e); }
});

/** PATCH /files/:id — renommer / déplacer / favori */
fileRouter.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFile(req, req.params.id, false);
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      folderId: z.string().nullable().optional(),
      isFavorite: z.boolean().optional(),
    });
    const input = schema.parse(req.body);
    if (input.name !== undefined) { f.name = sanitizeName(input.name); f.originalName = f.name; }
    if (input.folderId !== undefined) {
      if (input.folderId === null) f.folderId = null;
      else {
        const folder = await FolderModel.findById(input.folderId);
        if (!folder || String(folder.workspaceId) !== String(f.workspaceId) || folder.trashedAt) throw notFound("Folder not found");
        f.folderId = folder._id;
      }
    }
    if (input.isFavorite !== undefined) f.isFavorite = input.isFavorite;
    await f.save();
    res.json(ok({ file: f }));
  } catch (e) { next(e); }
});

/** DELETE /files/:id — corbeille (soft delete) */
fileRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFile(req, req.params.id, false);
    f.status = "trashed";
    f.trashedAt = new Date();
    await f.save();
    res.json(ok({ message: "Moved to trash" }));
  } catch (e) { next(e); }
});

/** POST /files/:id/restore */
fileRouter.post("/:id/restore", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFile(req, req.params.id);
    if (f.status !== "trashed") { res.json(ok({ file: f })); return; }
    if (f.folderId) {
      const folder = await FolderModel.findById(String(f.folderId));
      if (!folder || folder.trashedAt) f.folderId = null;
    }
    f.status = "ready";
    f.trashedAt = null;
    await f.save();
    res.json(ok({ file: f }));
  } catch (e) { next(e); }
});

/** DELETE /files/:id/permanent — suppression définitive + blob */
fileRouter.delete("/:id/permanent", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFile(req, req.params.id);
    await storage().delete(f.storageKey as string);
    await FileLinkModel.deleteMany({ fileId: f._id });
    await f.deleteOne();
    res.json(ok({ message: "Permanently deleted" }));
  } catch (e) { next(e); }
});

function streamFile(req: AuthRequest, res: Response, next: NextFunction, disposition: "inline" | "attachment") {
  (async () => {
    const f = await loadFile(req, req.params.id, false);
    const st = storage();
    if (!(await st.exists(f.storageKey as string))) throw notFound("Binary missing");
    const stat = await st.stat(f.storageKey as string);
    f.lastOpenedAt = new Date();
    await f.save();
    const mime = f.mimeType as string;
    const filename = encodeURIComponent((f.name as string) || "fichier");
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${filename}`);
    res.setHeader("Cache-Control", "private, max-age=300");
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m?.[1] ? Number(m[1]) : 0;
      const end = m?.[2] ? Number(m[2]) : Math.min(start + 1024 * 1024, stat.size - 1);
      if (Number.isNaN(start) || start >= stat.size) { res.status(416).end(); return; }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Content-Length", end - start + 1);
      st.readStream(f.storageKey as string, start, end).pipe(res);
    } else {
      st.readStream(f.storageKey as string).pipe(res);
    }
  })().catch(next);
}

/** GET /files/:id/download — flux authentifié */
fileRouter.get("/:id/download", (req: AuthRequest, res: Response, next: NextFunction) => {
  streamFile(req, res, next, "attachment");
});

/** GET /files/:id/preview — flux inline */
fileRouter.get("/:id/preview", (req: AuthRequest, res: Response, next: NextFunction) => {
  streamFile(req, res, next, "inline");
});

/** POST /files/:fileId/link — associer à tâche/projet/note/objectif */
fileRouter.post("/:fileId/link", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFile(req, req.params.fileId, false);
    const schema = z.object({ entityType: z.enum(LINKABLE_ENTITIES), entityId: z.string().min(1) });
    const input = schema.parse(req.body);
    await assertEntity(String(f.workspaceId), input.entityType, input.entityId, req.userId as string);
    const link = await FileLinkModel.findOneAndUpdate(
      { fileId: f._id, entityType: input.entityType, entityId: input.entityId },
      { $setOnInsert: { workspaceId: f.workspaceId, createdBy: req.userId } },
      { upsert: true, new: true }
    );
    res.status(201).json(ok({ link }));
  } catch (e) { next(e); }
});

/** DELETE /files/:fileId/link/:linkId */
fileRouter.delete("/:fileId/link/:linkId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFile(req, req.params.fileId);
    const link = await FileLinkModel.findById(req.params.linkId);
    if (!link || String(link.fileId) !== String(f._id)) throw notFound("Link not found");
    await link.deleteOne();
    res.json(ok({ message: "Unlinked" }));
  } catch (e) { next(e); }
});
