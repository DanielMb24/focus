import mongoose, { Schema } from "mongoose";
import { reuseOrCreate } from "../../shared/model.js";

const subtaskSchema = new Schema(
  { title: { type: String, required: true }, completed: { type: Boolean, default: false } },
  { _id: true }
);

const taskSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    status: { type: String, enum: ["todo", "in_progress", "completed", "cancelled"], default: "todo", index: true },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },
    startDate: { type: Date },
    dueDate: { type: Date, index: true },
    tags: { type: [String], default: [] },
    subtasks: { type: [subtaskSchema], default: [] },
    estimatedDuration: { type: Number },
    completedAt: { type: Date },
    position: { type: Number, default: 0 },
  },
  { timestamps: true }
);
taskSchema.index({ createdBy: 1, workspaceId: 1 });
taskSchema.index({ title: "text", description: "text" });
type TaskDoc = mongoose.InferSchemaType<typeof taskSchema>;
export const TaskModel = reuseOrCreate<TaskDoc>("Task", taskSchema);
