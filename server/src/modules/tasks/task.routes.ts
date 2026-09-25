import { Router } from "express";
import { z } from "zod";
import { TaskModel } from "./task.model.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { requireVerified } from "../../middleware/requireVerified.js";
import { ok, paginated, notFound, forbidden } from "../../shared/errors.js";
import { Response, NextFunction } from "express";
import { requireWorkspaceAccess } from "../workspaces/workspace.access.js";

const subtask = z.object({ title: z.string().min(1), completed: z.boolean().optional() });

const createSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  goalId: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(["todo", "in_progress", "completed", "cancelled"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  subtasks: z.array(subtask).default([]),
  estimatedDuration: z.number().optional().nullable(),
});

export const taskRouter = Router();
taskRouter.use(requireAuth, requireVerified);

function buildFilter(q: Record<string, string>, userId: string): Record<string, unknown> {
  const f: Record<string, unknown> = { createdBy: userId };
  if (q["workspaceId"]) f["workspaceId"] = q["workspaceId"];
  if (q["projectId"]) f["projectId"] = q["projectId"];
  if (q["goalId"]) f["goalId"] = q["goalId"];
  if (q["status"]) f["status"] = q["status"];
  if (q["priority"]) f["priority"] = q["priority"];
  if (q["dueFrom"] || q["dueTo"]) {
    f["dueDate"] = {
      ...(q["dueFrom"] ? { $gte: new Date(q["dueFrom"]) } : {}),
      ...(q["dueTo"] ? { $lte: new Date(q["dueTo"]) } : {}),
    };
  }
  if (q["search"]) f["$text"] = { $search: q["search"] };
  if (q["tags"]) f["tags"] = { $in: String(q["tags"]).split(",") };
  return f;
}

taskRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    if (q["workspaceId"]) await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const filter = buildFilter(q, req.userId as string);
    const p = Math.max(1, Number(q["page"] ?? 1)), l = Math.min(100, Math.max(1, Number(q["limit"] ?? 20)));
    const sort: Record<string, 1 | -1> = q["sort"] === "dueDate" ? { dueDate: 1 } : { position: 1, updatedAt: -1 };
    const total = await TaskModel.countDocuments(filter);
    const items = await TaskModel.find(filter).sort(sort).skip((p - 1) * l).limit(l).lean();
    res.json(paginated(items, p, l, total));
  } catch (e) { next(e); }
});

taskRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = createSchema.parse(req.body);
    await requireWorkspaceAccess(req.userId as string, input.workspaceId);
    const count = await TaskModel.countDocuments({ createdBy: req.userId, status: input.status });
    const t = await TaskModel.create({
      ...input,
      projectId: input.projectId || undefined,
      goalId: input.goalId || undefined,
      createdBy: req.userId,
      position: count,
      completedAt: input.status === "completed" ? new Date() : undefined,
    });
    res.status(201).json(ok({ task: t }));
  } catch (e) { next(e); }
});

async function loadOwned(req: AuthRequest, id: string) {
  const t = await TaskModel.findById(id);
  if (!t) throw notFound("Task not found");
  if (t.createdBy.toString() !== req.userId) throw forbidden("No access to task");
  return t;
}

taskRouter.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadOwned(req, req.params.id);
    res.json(ok({ task: t }));
  } catch (e) { next(e); }
});

taskRouter.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadOwned(req, req.params.id);
    const input = createSchema.partial().omit({ workspaceId: true }).parse(req.body);
    Object.assign(t, { ...input, projectId: input.projectId === null ? undefined : (input.projectId ?? t.projectId) });
    if (input.status) t.completedAt = input.status === "completed" ? new Date() : undefined;
    await t.save();
    res.json(ok({ task: t }));
  } catch (e) { next(e); }
});

taskRouter.patch("/:id/complete", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadOwned(req, req.params.id);
    t.status = t.status === "completed" ? "todo" : "completed";
    t.completedAt = t.status === "completed" ? new Date() : undefined;
    await t.save();
    res.json(ok({ task: t }));
  } catch (e) { next(e); }
});

taskRouter.patch("/:id/move", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ status: z.enum(["todo", "in_progress", "completed", "cancelled"]), position: z.number().optional() });
    const input = schema.parse(req.body);
    const t = await loadOwned(req, req.params.id);
    t.status = input.status;
    if (typeof input.position === "number") t.position = input.position;
    t.completedAt = input.status === "completed" ? new Date() : undefined;
    await t.save();
    res.json(ok({ task: t }));
  } catch (e) { next(e); }
});

taskRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadOwned(req, req.params.id);
    await t.deleteOne();
    res.json(ok({ message: "Deleted" }));
  } catch (e) { next(e); }
});


