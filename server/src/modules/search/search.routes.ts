import { Router } from "express";
import { TaskModel } from "../tasks/task.model.js";
import { ProjectModel } from "../projects/project.model.js";
import { GoalModel, NoteModel } from "../users/extra.models.js";
import { FileAssetModel } from "../files/file.model.js";
import { requireAuth, AuthRequest } from "../../middleware/auth.js";
import { ok, forbidden } from "../../shared/errors.js";
import { Response, NextFunction } from "express";
import { requireWorkspaceAccess } from "../workspaces/workspace.access.js";

/** Recherche globale en UN seul aller-retour (palette Ctrl+K). */
export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>;
    const needle = (q["q"] ?? "").trim().slice(0, 80);
    if (needle.length < 2) { res.json(ok({ tasks: [], projects: [], files: [], notes: [], goals: [] })); return; }
    if (!q["workspaceId"]) throw forbidden("workspaceId required");
    await requireWorkspaceAccess(req.userId as string, q["workspaceId"]);
    const rx = { $regex: needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const uid = req.userId as string;
    const [tasks, projects, files, notes, goals] = await Promise.all([
      TaskModel.find({ createdBy: uid, workspaceId: q["workspaceId"], status: { $ne: "cancelled" }, title: rx }).select("_id title status priority").limit(6).lean(),
      ProjectModel.find({ workspaceId: q["workspaceId"], name: rx }).select("_id name").limit(4).lean(),
      FileAssetModel.find({ workspaceId: q["workspaceId"], status: { $ne: "trashed" }, name: rx }).select("_id name mimeType size").limit(5).lean(),
      NoteModel.find({ createdBy: uid, workspaceId: q["workspaceId"], title: rx }).select("_id title").limit(4).lean(),
      GoalModel.find({ createdBy: uid, workspaceId: q["workspaceId"], title: rx }).select("_id title").limit(4).lean(),
    ]);
    res.json(ok({ tasks, projects, files, notes, goals }));
  } catch (e) { next(e); }
});
