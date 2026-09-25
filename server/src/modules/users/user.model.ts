import mongoose, { Schema, InferSchemaType } from "mongoose";
import { reuseOrCreate } from "../../shared/model.js";

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, select: false },
    authProvider: { type: String, enum: ["local", "google", "apple", "microsoft"], default: "local" },
    providerId: { type: String },
    profileType: { type: String, enum: ["student", "professional", "entrepreneur"], required: true },
    onboardingCompleted: { type: Boolean, default: false },
    // Vérification d'email : false explicite = bloqué (requireVerified).
    // Les comptes antérieurs (champ absent) restent autorisés.
    emailVerified: { type: Boolean, default: false },
    verificationCodeHash: { type: String, select: false },
    verificationExpiresAt: { type: Date },
    verificationSentAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date },
    avatar: { type: String },
    preferences: {
      language: { type: String, default: "fr" },
      timezone: { type: String, default: "Europe/Paris" },
      theme: { type: String, enum: ["light", "dark", "system"], default: "light" },
    },
  },
  { timestamps: true, toJSON: { transform(_doc, ret) { const r = ret as Record<string, unknown>; delete r["passwordHash"]; delete r["__v"]; return r; } } }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const UserModel = reuseOrCreate<UserDoc>("User", userSchema);
