import { Router } from "express";
import { z } from "zod";
import { ProjectModel } from "./project.model.js";
import { TaskModel } from "../tasks/task.model.js";
import { FolderModel } from "../files/folder.model.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { ok, paginated, notFound } from "../../shared/errors.js";
import { Response, NextFunction } from "express";
import { requireWorkspaceAccess } from "../workspaces/workspace.access.js";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  status: z.enum(["active", "completed", "archived"]).default("active"),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  createFolder: z.boolean().optional(),
});

export const projectRouter = Router();
projectRouter.use(requireAuth);

projectRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workspaceId, status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { createdBy: req.userId };
    if (workspaceId) { await requireWorkspaceAccess(req.userId as string, workspaceId); filter["workspaceId"] = workspaceId; }
    if (status) filter["status"] = status;
    if (search) filter["name"] = { $regex: search, $options: "i" };
    const p = Math.max(1, Number(page)), l = Math.min(100, Math.max(1, Number(limit)));
    const total = await ProjectModel.countDocuments(filter);
    const items = await ProjectModel.find(filter).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l).lean();
    // attach progress
    const withProgress = await Promise.all(items.map(async (pr) => {
      const totalT = await TaskModel.countDocuments({ projectId: pr._id, status: { $ne: "cancelled" } });
      const doneT = await TaskModel.countDocuments({ projectId: pr._id, status: "completed" });
      return { ...pr, progress: totalT ? Math.round((doneT / totalT) * 100) : 0, totalTasks: totalT, completedTasks: doneT };
    }));
    res.json(paginated(withProgress, p, l, total));
  } catch (e) { next(e); }
});

projectRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = createSchema.parse(req.body);
    await requireWorkspaceAccess(req.userId as string, input.workspaceId);
    const { createFolder, ...rest } = input;
    const p = await ProjectModel.create({ ...rest, createdBy: req.userId });
    let folderId: string | undefined;
    if (createFolder) {
      const folder = await FolderModel.create({ workspaceId: input.workspaceId, name: input.name, parentId: null, createdBy: req.userId, color: input.color });
      folderId = String(folder._id);
    }
    res.status(201).json(ok({ project: { ...p.toObject(), progress: 0 }, folderId }));
  } catch (e) { next(e); }
});

projectRouter.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await ProjectModel.findById(req.params.id).lean();
    if (!p) throw notFound("Project not found");
    await requireWorkspaceAccess(req.userId as string, String(p.workspaceId));
    const totalT = await TaskModel.countDocuments({ projectId: p._id, status: { $ne: "cancelled" } });
    const doneT = await TaskModel.countDocuments({ projectId: p._id, status: "completed" });
    res.json(ok({ project: { ...p, progress: totalT ? Math.round((doneT / totalT) * 100) : 0, totalTasks: totalT, completedTasks: doneT } }));
  } catch (e) { next(e); }
});

projectRouter.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await ProjectModel.findById(req.params.id);
    if (!p) throw notFound("Project not found");
    await requireWorkspaceAccess(req.userId as string, String(p.workspaceId));
    const schema = createSchema.partial().omit({ workspaceId: true });
    const input = schema.parse(req.body);
    Object.assign(p, input);
    await p.save();
    res.json(ok({ project: p }));
  } catch (e) { next(e); }
});

projectRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await ProjectModel.findById(req.params.id);
    if (!p) throw notFound("Project not found");
    await requireWorkspaceAccess(req.userId as string, String(p.workspaceId));
    await p.deleteOne();
    await TaskModel.updateMany({ projectId: p._id }, { $unset: { projectId: 1 } });
    res.json(ok({ message: "Deleted" }));
  } catch (e) { next(e); }
});

projectRouter.get("/:id/stats", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await ProjectModel.findById(req.params.id).lean();
    if (!p) throw notFound("Project not found");
    await requireWorkspaceAccess(req.userId as string, String(p.workspaceId));
    const byStatus = await TaskModel.aggregate([
      { $match: { projectId: p._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const total = await TaskModel.countDocuments({ projectId: p._id, status: { $ne: "cancelled" } });
    const done = await TaskModel.countDocuments({ projectId: p._id, status: "completed" });
    res.json(ok({ stats: { byStatus, total, done, progress: total ? Math.round((done / total) * 100) : 0 } }));
  } catch (e) { next(e); }
});
