import { Router } from "express";
import { z } from "zod";
import { WorkspaceModel, WorkspaceMemberModel } from "./workspace.model.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { requireVerified } from "../../middleware/requireVerified.js";
import { validate } from "../../middleware/validate.js";
import { ok, paginated, notFound, forbidden } from "../../shared/errors.js";
import { Response, NextFunction } from "express";
import { requireWorkspaceAccess } from "./workspace.access.js";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["personal", "school", "work", "business"]).default("personal"),
});

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth, requireVerified);

workspaceRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const memberships = await WorkspaceMemberModel.find({ userId: req.userId }).lean();
    const ids = memberships.map((m) => m.workspaceId);
    const owned = await WorkspaceModel.find({ ownerId: req.userId }).lean();
    const memberWs = ids.length ? await WorkspaceModel.find({ _id: { $in: ids } }).lean() : [];
    const map = new Map<string, unknown>();
    [...owned, ...memberWs].forEach((w) => map.set(String((w as { _id: unknown })._id), w));
    const data = [...map.values()];
    res.json(ok({ workspaces: data }));
  } catch (e) { next(e); }
});

workspaceRouter.post("/", validate(createSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, type } = req.body as { name: string; type: "personal" | "school" | "work" | "business" };
    const slug = `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Math.random().toString(36).slice(2, 7)}`;
    const ws = await WorkspaceModel.create({ name, slug, ownerId: req.userId, type });
    await WorkspaceMemberModel.create({ workspaceId: ws._id, userId: req.userId, role: "owner" });
    res.status(201).json(ok({ workspace: ws }));
  } catch (e) { next(e); }
});

workspaceRouter.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ws = await requireWorkspaceAccess(req.userId as string, req.params.id);
    res.json(ok({ workspace: ws }));
  } catch (e) { next(e); }
});

workspaceRouter.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(80).optional(), type: z.enum(["personal", "school", "work", "business"]).optional() });
    const input = schema.parse(req.body);
    const ws = await WorkspaceModel.findById(req.params.id);
    if (!ws) throw notFound("Workspace not found");
    if (ws.ownerId.toString() !== req.userId) throw forbidden("Only owner can update");
    Object.assign(ws, input);
    await ws.save();
    res.json(ok({ workspace: ws }));
  } catch (e) { next(e); }
});

workspaceRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ws = await WorkspaceModel.findById(req.params.id);
    if (!ws) throw notFound("Workspace not found");
    if (ws.ownerId.toString() !== req.userId) throw forbidden("Only owner can delete");
    await ws.deleteOne();
    await WorkspaceMemberModel.deleteMany({ workspaceId: ws._id });
    res.json(ok({ message: "Deleted" }));
  } catch (e) { next(e); }
});

// paginated helper export reused
export { paginated };


