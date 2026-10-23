/** Login username, pendaftaran mandiri ditutup, ganti password, diuji lewat handler HTTP Better Auth. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/auth";
import { basePrisma, createTestUser, resetDb, TEST_PASSWORD } from "../support/db";

const ORIGIN = "http://localhost:3000";

function call(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

let user: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  await resetDb();
  user = await createTestUser("Dina");
});
afterAll(() => basePrisma.$disconnect());

describe("akun & login", () => {
  it("pendaftaran mandiri ditutup (endpoint sign-up tidak tersedia)", async () => {
    const res = await call("/sign-up/email", { name: "X", email: "x@test.local", password: "Password-123", username: "xx" });
    expect(res.status).toBe(404);
    expect(await basePrisma.user.count({ where: { email: "x@test.local" } })).toBe(0);
  });

  it("endpoint email (login, lupa password, ubah profil) ditutup", async () => {
    for (const p of ["/sign-in/email", "/request-password-reset", "/update-user", "/delete-user"]) {
      expect((await call(p, {})).status, p).toBe(404);
    }
  });

  it("akun baru: password tersimpan sebagai hash argon2id, kategori default ter-provision", async () => {
    const acc = await basePrisma.account.findFirstOrThrow({ where: { userId: user.userId, providerId: "credential" } });
    expect(acc.password).toMatch(/^\$argon2id\$/);
    expect(await basePrisma.category.count({ where: { userId: user.userId } })).toBeGreaterThan(30);
  });

  it("login dengan username (tidak peka huruf besar) berhasil, password salah ditolak", async () => {
    const ok = await call("/sign-in/username", { username: user.username.toUpperCase(), password: TEST_PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.headers.getSetCookie().join(";")).toContain("HttpOnly");
    expect((await basePrisma.user.findUniqueOrThrow({ where: { id: user.userId } })).lastLoginAt).not.toBeNull();
    const bad = await call("/sign-in/username", { username: user.username, password: "salah-salah-123" });
    expect(bad.status).toBe(401);
    const none = await call("/sign-in/username", { username: "tidakada", password: TEST_PASSWORD });
    expect(none.status).toBe(401);
  });

  it("ganti password sendiri: perlu password lama, lalu password lama tidak berlaku", async () => {
    const login = await call("/sign-in/username", { username: user.username, password: TEST_PASSWORD });
    const cookie = cookieOf(login);
    const wrong = await call("/change-password", { currentPassword: "bukan-ini-123", newPassword: "Baru-Sekali-456" }, cookie);
    expect(wrong.status).toBe(400);
    const ok = await call("/change-password", { currentPassword: TEST_PASSWORD, newPassword: "Baru-Sekali-456", revokeOtherSessions: true }, cookie);
    expect(ok.status).toBe(200);
    expect((await call("/sign-in/username", { username: user.username, password: TEST_PASSWORD })).status).toBe(401);
    expect((await call("/sign-in/username", { username: user.username, password: "Baru-Sekali-456" })).status).toBe(200);
  });

  it("role tidak bisa diubah lewat API auth", async () => {
    const login = await call("/sign-in/username", { username: user.username, password: "Baru-Sekali-456" });
    await call("/update-user", { role: "ADMIN" }, cookieOf(login));
    expect((await basePrisma.user.findUniqueOrThrow({ where: { id: user.userId } })).role).toBe("USER");
  });
});
