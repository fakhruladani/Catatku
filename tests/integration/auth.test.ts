import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { auth } from "@/server/auth/auth";
import { outbox } from "@/server/email";
import { basePrisma, resetDb } from "../support/db";

const EMAIL = "dina@test.local";
const PASSWORD = "Rahasia-Kuat-123";

function lastLink(to: string): string {
  const msg = [...outbox].reverse().find((m) => m.to === to);
  if (!msg) throw new Error(`Tidak ada email untuk ${to}`);
  const m = /(https?:\/\/\S+)/.exec(msg.text);
  return m![1]!;
}

async function signIn(email: string, password: string) {
  return auth.api.signInEmail({ body: { email, password }, asResponse: true });
}

beforeAll(async () => {
  await resetDb();
  outbox.length = 0;
});
afterAll(async () => {
  await basePrisma.$disconnect();
});

describe("registrasi, verifikasi email, login", () => {
  it("registrasi membuat user + preferensi + SALINAN kategori default, dan mengirim email verifikasi", async () => {
    const res = await auth.api.signUpEmail({ body: { name: "Dina", email: EMAIL, password: PASSWORD }, asResponse: true });
    expect(res.status).toBe(200);
    const user = await basePrisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.emailVerified).toBe(false);

    const pref = await basePrisma.userPreference.findUnique({ where: { userId: user.id } });
    expect(pref?.financialMonthStartDay).toBe(1);

    const expectedCount = DEFAULT_CATEGORIES.reduce((n, c) => n + 1 + (c.children?.length ?? 0), 0);
    expect(await basePrisma.category.count({ where: { userId: user.id } })).toBe(expectedCount);

    expect(outbox.some((m) => m.to === EMAIL && m.subject.includes("Verifikasi"))).toBe(true);
  });

  it("password disimpan sebagai hash argon2id, bukan teks asli", async () => {
    const user = await basePrisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const acc = await basePrisma.account.findFirstOrThrow({ where: { userId: user.id, providerId: "credential" } });
    expect(acc.password).toMatch(/^\$argon2id\$/);
    expect(acc.password).not.toContain(PASSWORD);
  });

  it("login ditolak sebelum email diverifikasi", async () => {
    const res = await signIn(EMAIL, PASSWORD);
    expect(res.status).toBe(403);
  });

  it("setelah verifikasi, login berhasil dan cookie sesi httpOnly", async () => {
    const link = new URL(lastLink(EMAIL));
    const token = link.searchParams.get("token")!;
    await auth.api.verifyEmail({ query: { token } });
    const user = await basePrisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.emailVerified).toBe(true);

    const res = await signIn(EMAIL, PASSWORD);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(await basePrisma.session.count({ where: { userId: user.id } })).toBeGreaterThan(0);
  });

  it("password salah ditolak", async () => {
    const res = await signIn(EMAIL, "salah-password-123");
    expect(res.status).toBe(401);
  });

  it("email unik: registrasi ulang dengan email sama tidak membuat user kedua", async () => {
    await auth.api
      .signUpEmail({ body: { name: "Palsu", email: EMAIL, password: PASSWORD }, asResponse: true })
      .catch(() => undefined);
    expect(await basePrisma.user.count({ where: { email: EMAIL } })).toBe(1);
  });

  it("password < 8 karakter ditolak server", async () => {
    const res = await auth.api.signUpEmail({
      body: { name: "Pendek", email: "pendek@test.local", password: "1234567" },
      asResponse: true,
    });
    expect(res.status).toBe(400);
    expect(await basePrisma.user.count({ where: { email: "pendek@test.local" } })).toBe(0);
  });

  it("reset password: token dari email mengganti password & mencabut semua sesi", async () => {
    await auth.api.requestPasswordReset({ body: { email: EMAIL, redirectTo: "/reset-password" } });
    const link = lastLink(EMAIL);
    const token = new URL(link).pathname.split("/").pop()!;
    await auth.api.resetPassword({ body: { newPassword: "Password-Baru-456", token } });

    const user = await basePrisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(await basePrisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(401);
    expect((await signIn(EMAIL, "Password-Baru-456")).status).toBe(200);
  });
});
