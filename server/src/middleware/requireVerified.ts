import { Response, NextFunction } from "express";
import { UserModel } from "../modules/users/user.model.js";
import { AppError } from "../shared/errors.js";
import { requireEmailVerification } from "../config/env.js";
import type { AuthRequest } from "./auth.js";

/**
 * Bloque l'accès aux données tant que l'email n'est pas vérifié.
 * Inactif si REQUIRE_EMAIL_VERIFICATION=false. Seul un
 * `emailVerified === false` explicite bloque : les comptes
 * antérieurs (champ absent) restent autorisés.
 */
export async function requireVerified(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!requireEmailVerification()) {
      next();
      return;
    }
    const user = await UserModel.findById(req.userId).select("emailVerified").lean();
    if (!user) {
      const err = new Error("User not found") as Error & { status?: number; code?: string };
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }
    if ((user as { emailVerified?: boolean }).emailVerified === false) {
      throw new AppError(403, "EMAIL_NOT_VERIFIED", "Vérifiez votre adresse email pour continuer.");
    }
    next();
  } catch (e) {
    next(e);
  }
}

