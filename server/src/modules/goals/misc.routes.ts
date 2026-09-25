import { Router } from "express";
import { z } from "zod";
import { GoalModel, NoteModel, FocusSessionModel } from "../users/extra.models.js";
import { TaskModel } from "../tasks/task.model.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { requireVerified } from "../../middleware/requireVerified.js";
import { ok, paginated, notFound, forbidden } from "../../shared/errors.js";
import { Response, NextFunction } from "express";
import { requireWorkspaceAccess } from "../workspaces/workspace.access.js";

export const goalRouter = Router();
goalRouter.use(requireAuth, requireVerified);

const goalCreate = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  targetDate: z.string().optional().nullable(),
  status: z.enum(["active", "completed", "archived"]).default("active"),
});

goalRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { createdBy: req.userId };
    if (q["workspaceId"]) { await requireWorkspaceAccess(req.userId as string, q["workspaceId"]); filter["workspaceId"] = q["workspaceId"]; }
    if (q["status"]) filter["status"] = q["status"];
    const p = Math.max(1, Number(q["page"] ?? 1)), l = Math.min(100, Math.max(1, Number(q["limit"] ?? 20)));
    const total = await GoalModel.countDocuments(filter);
    const items = await GoalModel.find(filter).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l).lean();
    const enriched = await Promise.all(items.map(async (g) => {
      const totalT = await TaskModel.countDocuments({ goalId: g._id, status: { $ne: "cancelled" } });
      const doneT = await TaskModel.countDocuments({ goalId: g._id, status: "completed" });
      return { ...g, progress: totalT ? Math.round((doneT / totalT) * 100) : (g.progress ?? 0), totalTasks: totalT, completedTasks: doneT };
    }));
    res.json(paginated(enriched, p, l, total));
  } catch (e) { next(e); }
});

goalRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = goalCreate.parse(req.body);
    await requireWorkspaceAccess(req.userId as string, input.workspaceId);
    const g = await GoalModel.create({ ...input, createdBy: req.userId });
    res.status(201).json(ok({ goal: g }));
  } catch (e) { next(e); }
});

goalRouter.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const g = await GoalModel.findById(req.params.id).lean();
    if (!g) throw notFound("Goal not found");
    if (String(g.createdBy) !== req.userId) throw forbidden("No access");
    res.json(ok({ goal: g }));
  } catch (e) { next(e); }
});

goalRouter.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const g = await GoalModel.findById(req.params.id);
    if (!g) throw notFound("Goal not found");
    if (g.createdBy.toString() !== req.userId) throw forbidden("No access");
    const input = goalCreate.partial().omit({ workspaceId: true }).extend({ progress: z.number().min(0).max(100).optional() }).parse(req.body);
    Object.assign(g, input);
    await g.save();
    res.json(ok({ goal: g }));
  } catch (e) { next(e); }
});

goalRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const g = await GoalModel.findById(req.params.id);
    if (!g) throw notFound("Goal not found");
    if (g.createdBy.toString() !== req.userId) throw forbidden("No access");
    await g.deleteOne();
    await TaskModel.updateMany({ goalId: g._id }, { $unset: { goalId: 1 } });
    res.json(ok({ message: "Deleted" }));
  } catch (e) { next(e); }
});

// ---- Notes ----
export const noteRouter = Router();
noteRouter.use(requireAuth, requireVerified);
const noteCreate = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  title: z.string().min(1).max(160),
  content: z.string().optional().default(""),
});
noteRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { createdBy: req.userId };
    if (q["workspaceId"]) { await requireWorkspaceAccess(req.userId as string, q["workspaceId"]); filter["workspaceId"] = q["workspaceId"]; }
    if (q["projectId"]) filter["projectId"] = q["projectId"];
    if (q["search"]) filter["title"] = { $regex: q["search"], $options: "i" };
    const p = Math.max(1, Number(q["page"] ?? 1)), l = Math.min(100, Math.max(1, Number(q["limit"] ?? 20)));
    const total = await NoteModel.countDocuments(filter);
    const items = await NoteModel.find(filter).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l).lean();
    res.json(paginated(items, p, l, total));
  } catch (e) { next(e); }
});
noteRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = noteCreate.parse(req.body);
    await requireWorkspaceAccess(req.userId as string, input.workspaceId);
    const n = await NoteModel.create({ ...input, projectId: input.projectId || undefined, createdBy: req.userId });
    res.status(201).json(ok({ note: n }));
  } catch (e) { next(e); }
});
noteRouter.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const n = await NoteModel.findById(req.params.id);
    if (!n) throw notFound("Note not found");
    if (n.createdBy.toString() !== req.userId) throw forbidden("No access");
    const input = noteCreate.partial().omit({ workspaceId: true }).parse(req.body);
    Object.assign(n, input);
    await n.save();
    res.json(ok({ note: n }));
  } catch (e) { next(e); }
});
noteRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const n = await NoteModel.findById(req.params.id);
    if (!n) throw notFound("Note not found");
    if (n.createdBy.toString() !== req.userId) throw forbidden("No access");
    await n.deleteOne();
    res.json(ok({ message: "Deleted" }));
  } catch (e) { next(e); }
});

// ---- Focus ----
export const focusRouter = Router();
focusRouter.use(requireAuth, requireVerified);
focusRouter.post("/start", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ taskId: z.string().optional().nullable(), workspaceId: z.string().optional().nullable(), plannedSec: z.number().min(60).max(8 * 3600).default(25 * 60) });
    const input = schema.parse(req.body);
    const s = await FocusSessionModel.create({ userId: req.userId, taskId: input.taskId || undefined, workspaceId: input.workspaceId || undefined, plannedSec: input.plannedSec, startedAt: new Date() });
    res.status(201).json(ok({ session: s }));
  } catch (e) { next(e); }
});
focusRouter.post("/:id/stop", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const s = await FocusSessionModel.findById(req.params.id);
    if (!s) throw notFound("Session not found");
    if (s.userId.toString() !== req.userId) throw forbidden("No access");
    const endedAt = new Date();
    s.endedAt = endedAt;
    s.durationSec = Math.max(0, Math.round((endedAt.getTime() - s.startedAt.getTime()) / 1000));
    s.completed = s.durationSec >= Math.round(s.plannedSec * 0.9);
    await s.save();
    res.json(ok({ session: s }));
  } catch (e) { next(e); }
});
focusRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await FocusSessionModel.find({ userId: req.userId }).sort({ startedAt: -1 }).limit(50).lean();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const agg = await FocusSessionModel.aggregate([
      { $match: { userId: (await import("mongoose")).default.Types.ObjectId.createFromHexString(req.userId as string), startedAt: { $gte: today } } },
      { $group: { _id: null, totalSec: { $sum: "$durationSec" }, count: { $sum: 1 } } },
    ]);
    res.json(ok({ sessions: items, todayStats: agg[0] ?? { totalSec: 0, count: 0 } }));
  } catch (e) { next(e); }
});


