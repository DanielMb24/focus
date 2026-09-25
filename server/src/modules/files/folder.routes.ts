import { Router } from "express";
import { z } from "zod";
import { FolderModel } from "./folder.model.js";
import { FileAssetModel, FileLinkModel } from "./file.model.js";
import { copyFileAsset } from "./file.routes.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { requireVerified } from "../../middleware/requireVerified.js";
import { ok, paginated, notFound, forbidden } from "../../shared/errors.js";
import { Response, NextFunction } from "express";
import { requireWorkspaceAccess } from "../workspaces/workspace.access.js";
import { storage } from "./storage/index.js";

export const folderRouter = Router();
folderRouter.use(requireAuth, requireVerified);

async function loadFolder(req: AuthRequest, id: string) {
  const f = await FolderModel.findById(id);
  if (!f) throw notFound("Folder not found");
  await requireWorkspaceAccess(req.userId as string, String(f.workspaceId));
  return f;
}

/** Tous les descendants (BFS) — jamais d'arborescence imbriquée en base (§65). */
async function descendants(rootId: string): Promise<string[]> {
  const ids: string[] = [];
  let queue = [rootId];
  while (queue.length) {
    const children = await FolderModel.find({ parentId: { $in: queue } }).select("_id").lean();
    queue = children.map((c) => String(c._id));
    ids.push(...queue);
  }
  return ids;
}

async function assertNotDescendant(folderId: string, newParentId: string | null): Promise<void> {
  if (!newParentId) return;
  if (newParentId === folderId) throw forbidden("Cannot move a folder into itself");
  const desc = await descendants(folderId);
  if (desc.includes(newParentId)) throw forbidden("Cannot move a folder into its own subfolder");
}

folderRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    if (!q["workspaceId"]) throw forbidden("workspaceId required");
    await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const filter: Record<string, unknown> = { workspaceId: q["workspaceId"] };
    if (q["trashed"] === "true") filter["trashedAt"] = { $ne: null };
    else filter["trashedAt"] = null;
    if (q["parentId"] !== undefined && q["parentId"] !== "") {
      filter["parentId"] = q["parentId"] === "root" ? null : q["parentId"];
    }
    if (q["favorites"] === "true") filter["isFavorite"] = true;
    if (q["search"]) filter["name"] = { $regex: q["search"].slice(0, 80), $options: "i" };
    const p = Math.max(1, Number(q["page"] ?? 1)), l = Math.min(100, Math.max(1, Number(q["limit"] ?? 100)));
    const total = await FolderModel.countDocuments(filter);
    const items = await FolderModel.find(filter).sort({ name: 1 }).skip((p - 1) * l).limit(l).lean();
    res.json(paginated(items, p, l, total));
  } catch (e) { next(e); }
});

folderRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      workspaceId: z.string().min(1),
      name: z.string().min(1).max(120),
      parentId: z.string().nullable().optional(),
      color: z.string().optional(),
    });
    const input = schema.parse(req.body);
    await requireWorkspaceAccess(req.userId as string, input.workspaceId);
    if (input.parentId) {
      const parent = await FolderModel.findById(input.parentId);
      if (!parent || String(parent.workspaceId) !== input.workspaceId || parent.trashedAt) throw notFound("Parent folder not found");
    }
    const f = await FolderModel.create({
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      parentId: input.parentId || null,
      createdBy: req.userId,
      color: input.color,
    });
    res.status(201).json(ok({ folder: f }));
  } catch (e) { next(e); }
});

const TEMPLATES: Record<string, Record<string, unknown>> = {
  school: { "Études": { "Semestre 1": { "Mathématiques": null, "Algorithmique": null, "Base de données": null, "Anglais": null }, "Cours": null, "Exercices": null, "Devoirs": null, "Examens": null } },
  work: { "Travail": { "Projets": null, "Réunions": null, "Rapports": null, "Présentations": null } },
  business: { "Entreprise": { "Clients": null, "Contrats": null, "Propositions": null, "Administratif": null } },
  personal: { "Personnel": { "Documents": null, "Photos": null, "Administratif": null } },
};

/** POST /folders/template — structure type selon le profil d'usage (§118-120) */
folderRouter.post("/template", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ workspaceId: z.string().min(1), kind: z.enum(["school", "work", "business", "personal"]).optional() });
    const input = schema.parse(req.body);
    const ws = await requireWorkspaceAccess(req.userId as string, input.workspaceId);
    const kind = input.kind ?? (["school", "work", "business"].includes((ws as { type: string }).type) ? (ws as { type: string }).type : "personal");
    const tree = TEMPLATES[kind] ?? TEMPLATES["personal"];
    let created = 0;
    async function build(node: Record<string, unknown>, parentId: string | null) {
      for (const [name, children] of Object.entries(node)) {
        let existing = await FolderModel.findOne({ workspaceId: input.workspaceId, parentId, name, trashedAt: null });
        if (!existing) {
          existing = await FolderModel.create({ workspaceId: input.workspaceId, name, parentId, createdBy: req.userId });
          created++;
        }
        if (children && typeof children === "object") await build(children as Record<string, unknown>, String(existing._id));
      }
    }
    await build(tree as Record<string, unknown>, null);
    res.status(201).json(ok({ created }));
  } catch (e) { next(e); }
});

folderRouter.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFolder(req, req.params.id);
    const breadcrumb: { _id: string; name: string }[] = [];
    let cursor = f.parentId ? await FolderModel.findById(String(f.parentId)).lean() : null;
    while (cursor) {
      breadcrumb.unshift({ _id: String(cursor._id), name: cursor.name as string });
      cursor = cursor.parentId ? await FolderModel.findById(String(cursor.parentId)).lean() : null;
    }
    const subCount = await FolderModel.countDocuments({ parentId: f._id, trashedAt: null });
    const fileCount = await FileAssetModel.countDocuments({ folderId: f._id, status: { $ne: "trashed" } });
    res.json(ok({ folder: f, breadcrumb, subCount, fileCount }));
  } catch (e) { next(e); }
});

folderRouter.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFolder(req, req.params.id);
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      parentId: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      icon: z.string().nullable().optional(),
      isFavorite: z.boolean().optional(),
    });
    const input = schema.parse(req.body);
    if (input.name !== undefined) f.name = input.name.trim();
    if (input.parentId !== undefined) {
      if (input.parentId === null) f.parentId = null;
      else {
        const parent = await FolderModel.findById(input.parentId);
        if (!parent || String(parent.workspaceId) !== String(f.workspaceId) || parent.trashedAt) throw notFound("Parent folder not found");
        await assertNotDescendant(String(f._id), input.parentId);
        f.parentId = parent._id;
      }
    }
    if (input.color !== undefined) f.color = input.color ?? undefined;
    if (input.icon !== undefined) f.icon = input.icon ?? undefined;
    if (input.isFavorite !== undefined) f.isFavorite = input.isFavorite;
    await f.save();
    res.json(ok({ folder: f }));
  } catch (e) { next(e); }
});

/** POST /folders/:id/copy — duplique récursivement (dossiers + blobs) */
folderRouter.post("/:id/copy", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const src = await loadFolder(req, req.params.id);
    if (src.trashedAt) throw notFound("Folder not found");
    const schema = z.object({ parentId: z.string().nullable().optional(), name: z.string().min(1).max(120).optional() });
    const input = schema.parse(req.body);
    const destParent = input.parentId === undefined ? (src.parentId ? String(src.parentId) : null) : input.parentId;
    if (destParent) {
      const parent = await FolderModel.findById(destParent);
      if (!parent || String(parent.workspaceId) !== String(src.workspaceId) || parent.trashedAt) throw notFound("Parent folder not found");
      await assertNotDescendant(String(src._id), destParent);
    }

    async function copyRecursive(srcId: string, parentId: string | null, newName?: string): Promise<string> {
      const s = await FolderModel.findById(srcId);
      if (!s) throw notFound("Folder not found");
      const created = await FolderModel.create({
        workspaceId: s.workspaceId,
        name: newName ?? `Copie de ${s.name}`,
        parentId,
        createdBy: req.userId,
        color: s.color,
        icon: s.icon,
      });
      const newId = String(created._id);
      const files = await FileAssetModel.find({ folderId: s._id, status: { $ne: "trashed" } }).select("_id").lean();
      for (const f of files) await copyFileAsset(req.userId as string, String(f._id), newId);
      const subs = await FolderModel.find({ parentId: s._id, trashedAt: null }).select("_id").lean();
      for (const sub of subs) await copyRecursive(String(sub._id), newId);
      return newId;
    }

    const newId = await copyRecursive(String(src._id), destParent, input.name);
    const folder = await FolderModel.findById(newId);
    res.status(201).json(ok({ folder }));
  } catch (e) { next(e); }
});

/** DELETE /folders/:id — corbeille récursive */
folderRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFolder(req, req.params.id);
    const all = [String(f._id), ...(await descendants(String(f._id)))];
    const now = new Date();
    await FolderModel.updateMany({ _id: { $in: all } }, { $set: { trashedAt: now } });
    await FileAssetModel.updateMany({ folderId: { $in: all }, status: { $ne: "trashed" } }, { $set: { status: "trashed", trashedAt: now } });
    res.json(ok({ message: "Moved to trash" }));
  } catch (e) { next(e); }
});

/** POST /folders/:id/restore — restauration récursive */
folderRouter.post("/:id/restore", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFolder(req, req.params.id);
    const all = [String(f._id), ...(await descendants(String(f._id)))];
    await FolderModel.updateMany({ _id: { $in: all } }, { $set: { trashedAt: null } });
    await FileAssetModel.updateMany({ folderId: { $in: all }, status: "trashed" }, { $set: { status: "ready", trashedAt: null } });
    const updated = await FolderModel.findById(f._id);
    res.json(ok({ folder: updated }));
  } catch (e) { next(e); }
});

/** DELETE /folders/:id/permanent — suppression définitive récursive + blobs */
folderRouter.delete("/:id/permanent", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const f = await loadFolder(req, req.params.id);
    const all = [String(f._id), ...(await descendants(String(f._id)))];
    const files = await FileAssetModel.find({ folderId: { $in: all } }).select("storageKey").lean();
    for (const file of files) await storage().delete(file.storageKey as string).catch(() => null);
    const fileIds = await FileAssetModel.find({ folderId: { $in: all } }).select("_id").lean();
    await FileLinkModel.deleteMany({ fileId: { $in: fileIds.map((x) => x._id) } });
    await FileAssetModel.deleteMany({ folderId: { $in: all } });
    await FolderModel.deleteMany({ _id: { $in: all } });
    res.json(ok({ message: "Permanently deleted" }));
  } catch (e) { next(e); }
});


