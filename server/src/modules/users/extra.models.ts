import mongoose, { Schema } from "mongoose";
import { reuseOrCreate } from "../../shared/model.js";

const goalSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 160 },
    description: { type: String, maxlength: 2000 },
    targetDate: { type: Date },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ["active", "completed", "archived"], default: "active" },
  },
  { timestamps: true }
);
type GoalDoc = mongoose.InferSchemaType<typeof goalSchema>;
type NoteDoc = mongoose.InferSchemaType<typeof noteSchema>;
type FocusDoc = mongoose.InferSchemaType<typeof focusSchema>;
type RefreshDoc = mongoose.InferSchemaType<typeof refreshSchema>;
export const GoalModel = reuseOrCreate<GoalDoc>("Goal", goalSchema);

const noteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 160 },
    content: { type: String, default: "" },
  },
  { timestamps: true }
);
export const NoteModel = reuseOrCreate<NoteDoc>("Note", noteSchema);

const focusSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace" },
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    durationSec: { type: Number, default: 0 },
    plannedSec: { type: Number, required: true },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);
focusSchema.index({ userId: 1, startedAt: -1 });
export const FocusSessionModel = reuseOrCreate<FocusDoc>("FocusSession", focusSchema);

const refreshSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedBy: { type: String },
  },
  { timestamps: true }
);
refreshSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshTokenModel = reuseOrCreate<RefreshDoc>("RefreshToken", refreshSchema);
