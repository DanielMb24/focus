import { Request, Response, NextFunction } from "express";

/**
 * Limiteur de débit en mémoire (fenêtre fixe par IP).
 * Remplace express-rate-limit (dont les types ESM cassent le build selon
 * l'environnement). En serverless le compteur est par instance — suffisant
 * contre le brute-force à cette échelle ; passer à Redis si besoin.
 */
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, options.windowMs);
  timer.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({
        success: false,
        error: { code: "RATE_LIMITED", message: options.message ?? "Trop de requêtes, réessayez plus tard." },
      });
      return;
    }
    next();
  };
}

/** 50 tentatives / 15 min / IP sur l'authentification. */
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
