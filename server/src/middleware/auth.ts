import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserModel } from "../modules/users/user.model.js";

export interface AuthRequest extends Request {
  userId?: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as unknown as number,
  } as jwt.SignOptions);
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      const err = new Error("Missing token") as Error & { status?: number; code?: string };
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
    const user = await UserModel.findById(payload.sub).lean();
    if (!user) {
      const err = new Error("User not found") as Error & { status?: number; code?: string };
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }
    req.userId = payload.sub;
    next();
  } catch (e) {
    const err = e as Error & { status?: number; code?: string; name?: string };
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      const out = new Error("Invalid or expired token") as Error & { status?: number; code?: string };
      out.status = 401;
      out.code = "UNAUTHORIZED";
      return next(out);
    }
    next(e);
  }
}
