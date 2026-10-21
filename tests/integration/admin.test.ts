/** Manajemen akun oleh admin + penolakan untuk non-admin. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as tx from "@/features/transactions/service";
import { createAccount } from "@/server/admin/accounts";
import * as admin from "@/server/admin/service";
import { auth } from "@/server/auth/auth";
import { basePrisma, createTestUser, resetDb } from "../support/db";

let adminId: string;
let user: Awaited<ReturnType<typeof createTestUser>>;

const signIn = (username: string, password: string) =>
  auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/username", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ username, password }),
    }),
  );

beforeAll(async () => {
  await resetDb();
  ({ id: adminId } = await createAccount({ username: "admin", name: "Administrator", password: "password", role: "ADMIN" }));
  user = await createTestUser("Eko");
  await tx.createTransaction(user, { date: "2026-10-01", type: "EXPENSE", amount: 123_456n, description: "Rahasia Eko", categoryId: null });
});
afterAll(() => basePrisma.$disconnect());

describe("admin", () => {
  it("akun admin bawaan bisa login dengan admin/password dan tidak mendapat kategori buku kas", async () => {
    expect((await signIn("admin", "password")).status).toBe(200);
    expect(await basePrisma.category.count({ where: { userId: adminId } })).toBe(0);
  });

  it("membuat user baru → user bisa login", async () => {
    const res = await admin.createUser({ adminId }, { username: "Fina.Putri", name: "Fina", password: "Awal-Fina-123", confirm: "Awal-Fina-123" });
    expect(res.username).toBe("fina.putri");
    expect((await signIn("fina.putri", "Awal-Fina-123")).status).toBe(200);
  });

  it("username unik & formatnya divalidasi", async () => {
    await expect(admin.createUser({ adminId }, { username: "fina.putri", name: "x", password: "Awal-Fina-123", confirm: "Awal-Fina-123" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(admin.createUser({ adminId }, { username: "ada spasi", name: "x", password: "Awal-Fina-123", confirm: "Awal-Fina-123" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("daftar user: hanya metadata (tanpa isi transaksi), admin tidak ikut terdaftar", async () => {
    const list = await admin.listUsers({ adminId });
    expect(list.map((u) => u.username).sort()).toEqual(["eko1", "fina.putri"].sort());
    expect(list.find((u) => u.username === "eko1")?.transactionCount).toBe(1);
    const json = JSON.stringify(list, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    expect(json).not.toContain("Rahasia Eko");
    expect(json).not.toContain("123456");
  });

  it("reset password user: password lama tidak berlaku & sesi user dicabut", async () => {
    expect((await signIn(user.username, "Rahasia-Uji-123")).status).toBe(200);
    expect(await basePrisma.session.count({ where: { userId: user.userId } })).toBeGreaterThan(0);
    await admin.resetUserPassword({ adminId }, { userId: user.userId, password: "Baru-Eko-456", confirm: "Baru-Eko-456" });
    expect(await basePrisma.session.count({ where: { userId: user.userId } })).toBe(0);
    expect((await signIn(user.username, "Rahasia-Uji-123")).status).toBe(401);
    expect((await signIn(user.username, "Baru-Eko-456")).status).toBe(200);
  });

  it("hapus user butuh konfirmasi username, lalu menghapus seluruh datanya", async () => {
    await expect(admin.deleteUser({ adminId }, { userId: user.userId, confirmUsername: "salah" })).rejects.toMatchObject({ code: "VALIDATION" });
    await admin.deleteUser({ adminId }, { userId: user.userId, confirmUsername: user.username });
    expect(await basePrisma.user.count({ where: { id: user.userId } })).toBe(0);
    expect(await basePrisma.transaction.count({ where: { userId: user.userId } })).toBe(0);
    expect(await basePrisma.category.count({ where: { userId: user.userId } })).toBe(0);
    expect((await signIn(user.username, "Baru-Eko-456")).status).toBe(401);
  });

  it("akun admin tidak bisa di-reset/dihapus lewat panel", async () => {
    await expect(admin.deleteUser({ adminId }, { userId: adminId, confirmUsername: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.resetUserPassword({ adminId }, { userId: adminId, password: "x-x-x-x-x1", confirm: "x-x-x-x-x1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("user biasa TIDAK bisa memakai fungsi admin", async () => {
    const biasa = await createTestUser("Gita");
    const ctx = { adminId: biasa.userId };
    const fina = (await admin.listUsers({ adminId })).find((u) => u.username === "fina.putri")!;
    await expect(admin.listUsers(ctx)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.createUser(ctx, { username: "penyusup", name: "x", password: "Penyusup-123", confirm: "Penyusup-123" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.resetUserPassword(ctx, { userId: fina.id, password: "Dibajak-123", confirm: "Dibajak-123" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.deleteUser(ctx, { userId: fina.id, confirmUsername: "fina.putri" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await basePrisma.user.count({ where: { username: "penyusup" } })).toBe(0);
    expect(await basePrisma.user.count({ where: { username: "fina.putri" } })).toBe(1);
  });
});
