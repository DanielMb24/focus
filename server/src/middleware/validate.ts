import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../shared/errors.js";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError(400, "VALIDATION_ERROR", "Invalid input", result.error.flatten()));
    }
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}
