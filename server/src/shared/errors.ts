export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "EMAIL_NOT_VERIFIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "STORAGE_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  status: number;
  code: ErrorCode;
  details?: unknown;
  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (msg = "Not found") => new AppError(404, "NOT_FOUND", msg);
export const unauthorized = (msg = "Unauthorized") => new AppError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "Forbidden") => new AppError(403, "FORBIDDEN", msg);
export const conflict = (msg = "Conflict") => new AppError(409, "CONFLICT", msg);

export function ok<T>(data: T) {
  return { success: true as const, data };
}

export function paginated<T>(data: T[], page: number, limit: number, total: number) {
  return {
    success: true as const,
    data,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
