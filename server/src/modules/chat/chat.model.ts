import mongoose, { Schema } from "mongoose";
import { reuseOrCreate } from "../../shared/model.js";

const convoMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastReadAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    type: { type: String, enum: ["direct", "group"], required: true },
    name: { type: String, trim: true, maxlength: 80 },
    members: { type: [convoMemberSchema], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);
conversationSchema.index({ workspaceId: 1, lastMessageAt: -1 });
type ConversationDoc = mongoose.InferSchemaType<typeof conversationSchema>;
export const ConversationModel = reuseOrCreate<ConversationDoc>("Conversation", conversationSchema);

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);
messageSchema.index({ conversationId: 1, createdAt: -1 });
type MessageDoc = mongoose.InferSchemaType<typeof messageSchema>;
export const MessageModel = reuseOrCreate<MessageDoc>("Message", messageSchema);
