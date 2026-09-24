import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { env } from "../config/env.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? `Fichier trop volumineux (max ${env.MAX_FILE_SIZE_MB} Mo)` : err.message;
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.flatten() },
    });
  }
  const e = err as { status?: number; code?: string; message?: string; details?: unknown };
  const status = typeof e.status === "number" ? e.status : 500;
  const code = e.code ?? (status === 500 ? "INTERNAL" : "INTERNAL");
  if (!env.isProd) console.error(err);
  res.status(status).json({
    success: false,
    error: {
      code,
      message: status === 500 ? "Internal server error" : (e.message ?? "Error"),
      ...(e.details && status !== 500 ? { details: e.details } : {}),
    },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
}
