import mongoose, { Schema } from "mongoose";
import { reuseOrCreate } from "../../shared/model.js";

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["personal", "school", "work", "business"], default: "personal" },
  },
  { timestamps: true }
);
workspaceSchema.index({ ownerId: 1, slug: 1 }, { unique: true });
type WorkspaceDoc = mongoose.InferSchemaType<typeof workspaceSchema>;
type WorkspaceMemberDoc = mongoose.InferSchemaType<typeof memberSchema>;
export const WorkspaceModel = reuseOrCreate<WorkspaceDoc>("Workspace", workspaceSchema);

const memberSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
  },
  { timestamps: true }
);
memberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
export const WorkspaceMemberModel = reuseOrCreate<WorkspaceMemberDoc>("WorkspaceMember", memberSchema);
