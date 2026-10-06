import { Router } from "express";
import { z } from "zod";
import { ConversationModel, MessageModel } from "./chat.model.js";
import { WorkspaceMemberModel } from "../workspaces/workspace.model.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { requireVerified } from "../../middleware/requireVerified.js";
import { ok, paginated, notFound, forbidden } from "../../shared/errors.js";
import { chatLimiter } from "../../middleware/rateLimit.js";
import { Response, NextFunction } from "express";
import { requireWorkspaceAccess } from "../workspaces/workspace.access.js";

export const chatRouter = Router();
chatRouter.use(requireAuth, requireVerified);

async function convoForUser(convoId: string, userId: string) {
  const c = await ConversationModel.findById(convoId);
  if (!c) throw notFound("Conversation not found");
  if (!c.members.some((m) => String(m.userId) === userId)) throw forbidden("No access");
  return c;
}

function memberView(c: {
  _id: unknown; workspaceId: unknown; type: string; name?: string;
  members: { userId: { _id?: unknown; firstName?: string; lastName?: string } | unknown; lastReadAt: Date }[];
  lastMessageAt: Date; createdAt: Date; updatedAt: Date;
}) {
  return {
    _id: c._id,
    workspaceId: c.workspaceId,
    type: c.type,
    name: c.name,
    members: c.members.map((m) => {
      const u = m.userId as { _id?: unknown; firstName?: string; lastName?: string };
      return u && typeof u === "object" && "firstName" in u
        ? { userId: String(u._id), firstName: u.firstName, lastName: (u as { lastName?: string }).lastName ?? "", lastReadAt: m.lastReadAt }
        : { userId: String(m.userId), firstName: "?", lastName: "", lastReadAt: m.lastReadAt };
    }),
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// Liste des discussions (avec dernier message + non-lus).
chatRouter.get("/conversations", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    if (!q["workspaceId"]) throw notFound("workspaceId requis");
    await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const convos = await ConversationModel.find({ workspaceId: q["workspaceId"], "members.userId": req.userId })
      .sort({ lastMessageAt: -1 })
      .populate("members.userId", "firstName lastName")
      .lean();
    const out = await Promise.all(convos.map(async (c) => {
      const last = await MessageModel.findOne({ conversationId: c._id }).sort({ createdAt: -1 }).lean();
      const me = (c.members as { userId: unknown; lastReadAt: Date }[]).find((m) => String(m.userId) === req.userId
        || String((m.userId as { _id?: unknown })?._id ?? "") === req.userId);
      const since = me?.lastReadAt ?? new Date(0);
      const unread = await MessageModel.countDocuments({
        conversationId: c._id, createdAt: { $gt: since }, senderId: { $ne: req.userId },
      });
      return {
        ...memberView(c as never),
        lastMessage: last ? { text: last.text, senderId: String(last.senderId), createdAt: last.createdAt } : null,
        unread,
      };
    }));
    res.json(ok({ conversations: out }));
  } catch (e) { next(e); }
});

const convoCreate = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(["direct", "group"]),
  memberIds: z.array(z.string().min(1)).min(1).max(20),
  name: z.string().max(80).optional(),
});

// Créer (ou réutiliser) une discussion.
chatRouter.post("/conversations", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = convoCreate.parse(req.body);
    await requireWorkspaceAccess(req.userId as string, input.workspaceId);
    const ids = [...new Set([...input.memberIds, req.userId as string])];
    if (input.type === "direct" && ids.length !== 2) throw notFound("Le direct exige exactement 2 membres");
    // Tous les membres doivent appartenir à l'espace.
    const found = await WorkspaceMemberModel.find({ workspaceId: input.workspaceId, userId: { $in: ids } }).lean();
    if (found.length !== ids.length) throw forbidden("Membre hors espace");
    if (input.type === "direct") {
      const existing = await ConversationModel.findOne({
        workspaceId: input.workspaceId, type: "direct",
        "members.userId": { $all: ids }, members: { $size: 2 },
      }).populate("members.userId", "firstName lastName").lean();
      if (existing) return res.json(ok({ conversation: memberView(existing as never), reused: true }));
    }
    const c = await ConversationModel.create({
      workspaceId: input.workspaceId,
      type: input.type,
      name: input.type === "group" ? (input.name?.trim() || `Groupe (${ids.length})`) : undefined,
      members: ids.map((id) => ({ userId: id, lastReadAt: new Date() })),
      createdBy: req.userId,
    });
    const full = await ConversationModel.findById(c._id).populate("members.userId", "firstName lastName").lean();
    res.status(201).json(ok({ conversation: memberView(full as never), reused: false }));
  } catch (e) { next(e); }
});

// Historique (ordre croissant, pagination par `before`).
chatRouter.get("/conversations/:id/messages", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await convoForUser(req.params.id, req.userId as string);
    const q = req.query as Record<string, string>;
    const l = Math.min(100, Math.max(1, Number(q["limit"] ?? 50)));
    const filter: Record<string, unknown> = { conversationId: req.params.id };
    if (q["before"]) filter["createdAt"] = { $lt: new Date(q["before"]) };
    const total = await MessageModel.countDocuments(filter);
    const items = await MessageModel.find(filter).sort({ createdAt: -1 }).limit(l + 1).lean();
    const hasMore = items.length > l;
    const page = (hasMore ? items.slice(0, l) : items).reverse();
    res.json(paginated(page.map((m) => ({
      _id: m._id, conversationId: String(m.conversationId), senderId: String(m.senderId),
      text: m.text, createdAt: m.createdAt,
    })), 1, l, total));
  } catch (e) { next(e); }
});

// Envoyer un message.
chatRouter.post("/conversations/:id/messages", chatLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const c = await convoForUser(req.params.id, req.userId as string);
    const input = z.object({ text: z.string().trim().min(1).max(2000) }).parse(req.body);
    const m = await MessageModel.create({
      conversationId: c._id, workspaceId: c.workspaceId, senderId: req.userId, text: input.text,
    });
    c.lastMessageAt = new Date();
    const me = c.members.find((x) => String(x.userId) === req.userId);
    if (me) me.lastReadAt = new Date();
    await c.save();
    res.status(201).json(ok({
      message: {
        _id: m._id, conversationId: String(m.conversationId), senderId: String(m.senderId),
        text: m.text, createdAt: (m as { createdAt: Date }).createdAt,
      },
    }));
  } catch (e) { next(e); }
});

// Marquer comme lu.
chatRouter.patch("/conversations/:id/read", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const c = await convoForUser(req.params.id, req.userId as string);
    const me = c.members.find((x) => String(x.userId) === req.userId);
    if (me) { me.lastReadAt = new Date(); await c.save(); }
    res.json(ok({ read: true }));
  } catch (e) { next(e); }
});
