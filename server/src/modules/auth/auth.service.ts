import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { UserModel } from "../users/user.model.js";
import { RefreshTokenModel } from "../users/extra.models.js";
import { WorkspaceModel, WorkspaceMemberModel } from "../workspaces/workspace.model.js";
import { unauthorized, conflict } from "../../shared/errors.js";
import { signAccessToken } from "../../middleware/auth.js";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "workspace";
}

export async function register(input: { firstName: string; lastName?: string; email: string; password: string; profileType: "student" | "professional" | "entrepreneur" }) {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) throw conflict("Email already in use");
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const user = await UserModel.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email.toLowerCase(),
    passwordHash,
    profileType: input.profileType,
    authProvider: "local",
  });
  return issueSession(user.id as string);
}

export async function login(email: string, password: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user?.passwordHash) throw unauthorized("Invalid credentials");
  const ok = await bcrypt.compare(password, user.passwordHash as string);
  if (!ok) throw unauthorized("Invalid credentials");
  return issueSession(user.id as string);
}

async function issueSession(userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = jwt.sign({ sub: userId, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as unknown as number,
  } as jwt.SignOptions);
  const decoded = jwt.decode(refreshToken) as { exp: number } | null;
  await RefreshTokenModel.create({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date((decoded?.exp ?? Math.floor(Date.now() / 1000) + 30 * 86400) * 1000),
  });
  const user = await UserModel.findById(userId);
  return { user, accessToken, refreshToken };
}

export async function refresh(oldToken: string) {
  let payload: { sub: string };
  try {
    payload = jwt.verify(oldToken, env.JWT_REFRESH_SECRET) as { sub: string };
  } catch {
    throw unauthorized("Invalid refresh token");
  }
  const stored = await RefreshTokenModel.findOne({ tokenHash: hashToken(oldToken) });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw unauthorized("Invalid refresh token");
  // rotation
  stored.revokedAt = new Date();
  await stored.save();
  return issueSession(payload.sub);
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  await RefreshTokenModel.updateOne({ tokenHash: hashToken(refreshToken) }, { $set: { revokedAt: new Date() } });
}

export async function completeOnboarding(userId: string, input: { firstName: string; profileType: "student" | "professional" | "entrepreneur"; workspaceName: string; workspaceType: "personal" | "school" | "work" | "business"; language: string; timezone: string }) {
  const user = await UserModel.findById(userId);
  if (!user) throw unauthorized("User not found");
  user.firstName = input.firstName;
  user.profileType = input.profileType;
  user.onboardingCompleted = true;
  user.preferences = { ...(user.preferences as object ?? {}), language: input.language, timezone: input.timezone, theme: "light" } as typeof user.preferences;
  await user.save();
  const base = slugify(input.workspaceName);
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  const ws = await WorkspaceModel.create({ name: input.workspaceName, slug, ownerId: user._id, type: input.workspaceType });
  await WorkspaceMemberModel.create({ workspaceId: ws._id, userId: user._id, role: "owner" });
  return { user, workspace: ws };
}
