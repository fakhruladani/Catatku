export type AppErrorCode = "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "FORBIDDEN" | "UNAUTHENTICATED";

/** Error yang aman ditampilkan ke user. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Data") => new AppError("NOT_FOUND", `${what} tidak ditemukan`);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);
export const invalid = (msg: string, fieldErrors?: Record<string, string[]>) =>
  new AppError("VALIDATION", msg, fieldErrors);
