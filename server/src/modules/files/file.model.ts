import mongoose, { Schema } from "mongoose";
import { reuseOrCreate } from "../../shared/model.js";

export const FILE_STATUS = ["uploading", "ready", "failed", "trashed"] as const;
export const LINKABLE_ENTITIES = ["task", "project", "note", "goal"] as const;

const fileSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    originalName: { type: String, required: true },
    extension: { type: String, lowercase: true, trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    storageKey: { type: String, required: true, unique: true },
    storageProvider: { type: String, default: "local" },
    checksum: { type: String },
    thumbnailUrl: { type: String },
    isFavorite: { type: Boolean, default: false },
    status: { type: String, enum: FILE_STATUS, default: "ready", index: true },
    trashedAt: { type: Date, default: null },
    lastOpenedAt: { type: Date, default: null },
    metadata: {
      width: { type: Number },
      height: { type: Number },
      duration: { type: Number },
    },
  },
  { timestamps: true }
);
fileSchema.index({ workspaceId: 1, folderId: 1, status: 1 });
fileSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
fileSchema.index({ name: "text" });

type FileDoc = mongoose.InferSchemaType<typeof fileSchema>;
export const FileAssetModel = reuseOrCreate<FileDoc>("FileAsset", fileSchema);

const fileLinkSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    fileId: { type: Schema.Types.ObjectId, ref: "FileAsset", required: true, index: true },
    entityType: { type: String, enum: LINKABLE_ENTITIES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
fileLinkSchema.index({ fileId: 1, entityType: 1, entityId: 1 }, { unique: true });
fileLinkSchema.index({ workspaceId: 1, entityType: 1, entityId: 1 });

type FileLinkDoc = mongoose.InferSchemaType<typeof fileLinkSchema>;
export const FileLinkModel = reuseOrCreate<FileLinkDoc>("FileLink", fileLinkSchema);

const uploadSessionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    status: { type: String, enum: ["pending", "uploading", "completed", "failed"], default: "pending" },
    fileId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
  },
  { timestamps: true }
);

type UploadSessionDoc = mongoose.InferSchemaType<typeof uploadSessionSchema>;
export const UploadSessionModel = reuseOrCreate<UploadSessionDoc>("UploadSession", uploadSessionSchema);
