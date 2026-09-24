import mongoose, { Schema } from "mongoose";
import { reuseOrCreate } from "../../shared/model.js";

const folderSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    parentId: { type: Schema.Types.ObjectId, ref: "Folder", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    color: { type: String },
    icon: { type: String },
    isFavorite: { type: Boolean, default: false },
    trashedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);
folderSchema.index({ workspaceId: 1, parentId: 1, name: 1 });
folderSchema.index({ workspaceId: 1, updatedAt: -1 });

type FolderDoc = mongoose.InferSchemaType<typeof folderSchema>;
export const FolderModel = reuseOrCreate<FolderDoc>("Folder", folderSchema);
