import mongoose, { Schema } from "mongoose";
import { reuseOrCreate } from "../../shared/model.js";

const projectSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 2000 },
    status: { type: String, enum: ["active", "completed", "archived"], default: "active", index: true },
    startDate: { type: Date },
    dueDate: { type: Date },
    color: { type: String, default: "#4f46e5" },
    icon: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
projectSchema.index({ workspaceId: 1, status: 1 });
type ProjectDoc = mongoose.InferSchemaType<typeof projectSchema>;
export const ProjectModel = reuseOrCreate<ProjectDoc>("Project", projectSchema);
