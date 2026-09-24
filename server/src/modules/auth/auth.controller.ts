import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as service from "./auth.service.js";
import { registerSchema, loginSchema, onboardingSchema } from "./auth.validation.js";
import { ok } from "../../shared/errors.js";
import { UserModel } from "../users/user.model.js";
import { env } from "../../config/env.js";
import type { AuthRequest } from "../../middleware/auth.js";

const REFRESH_COOKIE = "refreshToken";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? "none" : "lax",
    maxAge: 30 * 24 * 3600 * 1000,
    path: "/api/v1/auth",
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await service.register(input);
    setRefreshCookie(res, refreshToken);
    res.status(201).json(ok({ user, accessToken }));
  } catch (e) { next(e); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await service.login(input.email, input.password);
    setRefreshCookie(res, refreshToken);
    res.json(ok({ user, accessToken }));
  } catch (e) { next(e); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!token) { res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing refresh token" } }); return; }
    const { user, accessToken, refreshToken } = await service.refresh(token);
    setRefreshCookie(res, refreshToken);
    res.json(ok({ user, accessToken }));
  } catch (e) { next(e); }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await service.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    res.json(ok({ message: "Logged out" }));
  } catch (e) { next(e); }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await UserModel.findById(req.userId);
    res.json(ok({ user }));
  } catch (e) { next(e); }
}

export async function updateMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      firstName: z.string().min(1).max(80).optional(),
      lastName: z.string().max(80).optional().nullable(),
      avatar: z.string().url().optional().nullable(),
      preferences: z.object({ language: z.string().optional(), timezone: z.string().optional(), theme: z.enum(["light", "dark", "system"]).optional() }).optional(),
    });
    const input = schema.parse(req.body);
    const user = await UserModel.findByIdAndUpdate(req.userId, { $set: input }, { new: true });
    res.json(ok({ user }));
  } catch (e) { next(e); }
}

export async function onboarding(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const input = onboardingSchema.parse(req.body);
    const result = await service.completeOnboarding(req.userId as string, input);
    res.json(ok(result));
  } catch (e) { next(e); }
}
