import "server-only";
import { z } from "zod";
import { USERNAME_MAX } from "@/lib/username";
import { zName, zPassword } from "@/lib/validation";
import { removeAvatar } from "@/server/avatar";
import { basePrisma } from "@/server/db/base-client";
import { AppError, notFound } from "@/server/errors";
import { createAccount, setAccountPassword } from "./accounts";

/**
 * Manajemen akun oleh ADMIN. Satu-satunya modul lintas-user.
 * Admin TIDAK bisa membaca isi catatan keuangan user, hanya metadata (username, nama, tanggal, jumlah baris).
 */
export interface AdminCtx {
  adminId: string;
}

export const createUserSchema = z
  .object({
    username: z.string().trim().toLowerCase().min(3, "Username minimal 3 karakter").max(USERNAME_MAX, "Username maksimal 30 karakter"),
    name: zName("Nama", 60),
    password: zPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Password tidak sama" });

export const resetPasswordSchema = z
  .object({ userId: z.string().min(1), password: zPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Password tidak sama" });

export const deleteUserSchema = z.object({ userId: z.string().min(1), confirmUsername: z.string() });

const forbidden = () => new AppError("FORBIDDEN", "Hanya admin yang boleh melakukan ini");

/** Cek peran langsung ke database (bukan dari cache sesi). */
export async function assertAdmin(ctx: AdminCtx): Promise<void> {
  const u = await basePrisma.user.findUnique({ where: { id: ctx.adminId }, select: { role: true } });
  if (u?.role !== "ADMIN") throw forbidden();
}

async function findManagedUser(userId: string) {
  const u = await basePrisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, role: true } });
  if (!u) throw notFound("User");
  if (u.role !== "USER") throw new AppError("FORBIDDEN", "Akun admin tidak bisa diubah dari sini");
  return u;
}

export interface ManagedUserDto {
  id: string;
  username: string;
  name: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  transactionCount: number;
}

export async function listUsers(ctx: AdminCtx): Promise<ManagedUserDto[]> {
  await assertAdmin(ctx);
  const [users, counts] = await Promise.all([
    basePrisma.user.findMany({
      where: { role: "USER" },
      select: { id: true, username: true, name: true, createdAt: true, lastLoginAt: true },
      orderBy: { createdAt: "asc" },
    }),
    basePrisma.transaction.groupBy({ by: ["userId"], _count: { _all: true } }),
  ]);
  const byUser = new Map(counts.map((c) => [c.userId, c._count._all]));
  return users.map((u) => ({
    id: u.id,
    username: u.username ?? "",
    name: u.name,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    transactionCount: byUser.get(u.id) ?? 0,
  }));
}

export async function createUser(ctx: AdminCtx, input: z.output<typeof createUserSchema>) {
  await assertAdmin(ctx);
  return createAccount({ username: input.username, name: input.name, password: input.password, role: "USER" });
}

export async function resetUserPassword(ctx: AdminCtx, input: z.output<typeof resetPasswordSchema>) {
  await assertAdmin(ctx);
  const u = await findManagedUser(input.userId);
  await setAccountPassword(u.id, input.password);
  return { username: u.username };
}

/** Hapus permanen: akun + SELURUH datanya (cascade). Wajib mengetik ulang username sebagai konfirmasi. */
export async function deleteUser(ctx: AdminCtx, input: z.output<typeof deleteUserSchema>) {
  await assertAdmin(ctx);
  const u = await findManagedUser(input.userId);
  if (input.confirmUsername.trim().toLowerCase() !== u.username) {
    throw new AppError("VALIDATION", "Ketik username dengan benar untuk konfirmasi", { confirmUsername: ["Username tidak cocok"] });
  }
  await basePrisma.user.delete({ where: { id: u.id } });
  await removeAvatar(u.id);
  return { username: u.username };
}
