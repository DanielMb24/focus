import { Router } from "express";
import { z } from "zod";
import { WorkspaceModel, WorkspaceMemberModel } from "./workspace.model.js";
import { UserModel } from "../users/user.model.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { requireVerified } from "../../middleware/requireVerified.js";
import { validate } from "../../middleware/validate.js";
import { ok, paginated, notFound, forbidden, conflict } from "../../shared/errors.js";
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

workspaceRouter.get("/:id/members", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await requireWorkspaceAccess(req.userId as string, req.params.id);
    const memberships = await WorkspaceMemberModel.find({ workspaceId: req.params.id }).lean();
    const users = await UserModel.find({ _id: { $in: memberships.map((m) => m.userId) } })
      .select("firstName lastName email").lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    res.json(ok({
      members: memberships.map((m) => {
        const u = byId.get(String(m.userId)) as { firstName?: string; lastName?: string; email?: string } | undefined;
        return { userId: String(m.userId), role: (m as { role?: string }).role ?? "member", firstName: u?.firstName ?? "?", lastName: u?.lastName ?? "", email: u?.email ?? "" };
      }),
    }));
  } catch (e) { next(e); }
});

// paginated helper export reused
export { paginated };

workspaceRouter.post("/:id/invite", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ws = await requireWorkspaceAccess(req.userId as string, req.params.id);
    const me = await WorkspaceMemberModel.findOne({ workspaceId: req.params.id, userId: req.userId }).lean();
    const role = (me as { role?: string } | null)?.role;
    if (String(ws.ownerId) !== req.userId && role !== "owner" && role !== "admin") {
      throw forbidden("Seuls les responsables de l'espace peuvent inviter");
    }
    const input = z.object({ email: z.string().email() }).parse(req.body);
    const user = await UserModel.findOne({ email: input.email.toLowerCase() }).select("firstName lastName email").lean();
    if (!user) throw notFound("Aucun compte avec cet email — la personne doit d'abord créer un compte Focus");
    const existing = await WorkspaceMemberModel.findOne({ workspaceId: req.params.id, userId: user._id }).lean();
    if (existing) throw conflict("Cette personne est déjà dans l'espace");
    const m = await WorkspaceMemberModel.create({ workspaceId: req.params.id, userId: user._id, role: "member" });
    res.status(201).json(ok({
      member: {
        userId: String(m.userId), role: "member",
        firstName: user.firstName, lastName: (user as { lastName?: string }).lastName ?? "", email: user.email,
      },
    }));
  } catch (e) { next(e); }
});


