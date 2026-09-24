import { WorkspaceMemberModel, WorkspaceModel } from "./workspace.model.js";
import { forbidden, notFound } from "../../shared/errors.js";

export async function requireWorkspaceAccess(userId: string, workspaceId: string) {
  if (!workspaceId) throw forbidden("workspaceId required");
  const ws = await WorkspaceModel.findById(workspaceId);
  if (!ws) throw notFound("Workspace not found");
  const member = await WorkspaceMemberModel.findOne({ workspaceId, userId });
  const isOwner = ws.ownerId.toString() === userId;
  if (!member && !isOwner) throw forbidden("No access to workspace");
  return ws;
}
