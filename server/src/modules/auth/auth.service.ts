import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env, requireEmailVerification } from "../../config/env.js";
import { UserModel } from "../users/user.model.js";
import { RefreshTokenModel } from "../users/extra.models.js";
import { WorkspaceModel, WorkspaceMemberModel } from "../workspaces/workspace.model.js";
import { unauthorized, conflict, forbidden, AppError } from "../../shared/errors.js";
import { signAccessToken } from "../../middleware/auth.js";
import { sendMail, verificationEmail, resetEmail } from "../mail/mailer.js";

const VERIFY_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

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
    emailVerified: !requireEmailVerification() ? true : false,
  });
  if (requireEmailVerification()) {
    await sendVerificationCode(user.id as string);
  }
  const session = await issueSession(user.id as string);
  return { ...session, requiresVerification: requireEmailVerification() };
}

export async function login(email: string, password: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user?.passwordHash) throw unauthorized("Invalid credentials");
  const ok = await bcrypt.compare(password, user.passwordHash as string);
  if (!ok) throw unauthorized("Invalid credentials");
  const session = await issueSession(user.id as string);
  const verified = (session.user as { emailVerified?: boolean })?.emailVerified;
  return { ...session, requiresVerification: requireEmailVerification() && verified === false };
}

/** Génère + envoie un code à 6 chiffres (10 min). */
export async function sendVerificationCode(userId: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) throw unauthorized("User not found");
  if (user.emailVerified) return;
  const now = new Date();
  const sentAt = user.verificationSentAt as unknown as Date | undefined;
  if (sentAt && now.getTime() - sentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError(429, "RATE_LIMITED", "Attendez une minute avant de redemander un code.");
  }
  const code = String(crypto.randomInt(100000, 1000000));
  user.verificationCodeHash = await bcrypt.hash(code, env.BCRYPT_ROUNDS);
  user.verificationExpiresAt = new Date(now.getTime() + VERIFY_TTL_MS);
  user.verificationSentAt = now;
  await user.save();
  const mail = verificationEmail(user.firstName as string, code);
  mail.to = user.email as string;
  await sendMail(mail);
}

export async function verifyEmail(email: string, code: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+verificationCodeHash");
  if (!user || !user.verificationCodeHash || !user.verificationExpiresAt) {
    throw unauthorized("Code invalide ou expiré.");
  }
  if (user.verificationExpiresAt < new Date()) throw unauthorized("Code invalide ou expiré.");
  const ok = await bcrypt.compare(code.trim(), user.verificationCodeHash as string);
  if (!ok) throw unauthorized("Code invalide ou expiré.");
  user.emailVerified = true;
  user.verificationCodeHash = undefined;
  user.verificationExpiresAt = undefined;
  user.verificationSentAt = undefined;
  await user.save();
  return issueSession(user.id as string);
}

async function revokeUserTokens(userId: string): Promise<void> {
  await RefreshTokenModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await UserModel.findById(userId).select("+passwordHash");
  if (!user?.passwordHash) throw unauthorized("User not found");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash as string);
  if (!ok) throw unauthorized("Mot de passe actuel incorrect.");
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await user.save();
  await revokeUserTokens(userId);
  return { message: "Mot de passe modifié." };
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const done = { message: "Si un compte existe, un lien vient d'être envoyé." };
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) return done;
  const token = crypto.randomBytes(32).toString("hex");
  user.passwordResetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  const base = env.CLIENT_URL.split(",")[0].replace(/\/$/, "");
  const link = `${base}/reset-password?token=${token}&email=${encodeURIComponent(user.email as string)}`;
  const mail = resetEmail(user.firstName as string, link);
  mail.to = user.email as string;
  await sendMail(mail).catch(() => null);
  return done;
}

export async function resetPassword(email: string, token: string, newPassword: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordResetTokenHash");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  if (!user?.passwordResetTokenHash || user.passwordResetTokenHash !== hash || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    throw forbidden("Lien invalide ou expiré.");
  }
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  await revokeUserTokens(user.id as string);
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

