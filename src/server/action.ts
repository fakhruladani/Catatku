import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getSessionUser, type UserCtx } from "@/server/auth/session";
import { forUser, IsolationError } from "@/server/db/scoped";
import { AppError } from "@/server/errors";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Service = logika inti; menerima ctx dari sesi + input yang SUDAH divalidasi. */
export type Service<I, O> = (ctx: UserCtx, input: I) => Promise<O>;

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function toActionError(err: unknown): ActionResult<never> {
  if (err instanceof AppError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
  if (err instanceof IsolationError) {
    console.error("[isolation]", err.message);
    return { ok: false, error: "Akses ditolak" };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2003 = FK gagal: termasuk composite FK (id, userId) menolak referensi lintas-user
    if (err.code === "P2003") return { ok: false, error: "Data yang dirujuk tidak ditemukan" };
    if (err.code === "P2025") return { ok: false, error: "Data tidak ditemukan" };
    if (err.code === "P2002") return { ok: false, error: "Data sudah ada" };
  }
  console.error("[action]", err);
  return { ok: false, error: "Terjadi kesalahan. Coba lagi." };
}

/**
 * Pembungkus WAJIB untuk setiap Server Action yang menyentuh data user:
 * 1. ambil user dari sesi (bukan dari input),
 * 2. validasi input dengan Zod (field asing di-strip; tidak ada userId di skema),
 * 3. jalankan service dengan client yang ter-scope.
 */
export async function runAction<S extends z.ZodType, O>(
  schema: S,
  rawInput: unknown,
  service: Service<z.output<S>, O>,
): Promise<ActionResult<O>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };
  // Akun admin hanya mengelola akun; tidak punya buku kas.
  if (user.role !== "USER") return { ok: false, error: "Akun admin tidak memiliki buku kas" };
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian kamu", fieldErrors: zodFieldErrors(parsed.error) };
  }
  try {
    const data = await service({ userId: user.id, db: forUser(user.id) }, parsed.data);
    return { ok: true, data };
  } catch (err) {
    return toActionError(err);
  }
}
