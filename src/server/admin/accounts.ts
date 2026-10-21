import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@/server/auth/auth";
import { basePrisma } from "@/server/db/base-client";
import { invalid } from "@/server/errors";
import { provisionNewUser } from "@/server/provision";
import { internalEmail, normalizeUsername, USERNAME_RE } from "@/lib/username";

/**
 * Operasi akun tingkat rendah (lintas-user). HANYA dipanggil oleh service admin
 * (setelah cek peran), script create-admin, dan seed.
 */
export async function createAccount(input: {
  username: string;
  name: string;
  password: string;
  role?: "USER" | "ADMIN";
}): Promise<{ id: string; username: string }> {
  const username = normalizeUsername(input.username);
  if (!USERNAME_RE.test(username)) invalidUsername();
  if (input.password.length < 8 || input.password.length > 128) throw invalid("Password 8–128 karakter");
  const exists = await basePrisma.user.findUnique({ where: { username }, select: { id: true } });
  if (exists) throw invalid("Username sudah dipakai", { username: ["Username sudah dipakai"] });

  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  await basePrisma.$transaction([
    basePrisma.user.create({
      data: {
        id,
        name: input.name.trim(),
        email: internalEmail(username),
        emailVerified: true,
        username,
        role: input.role ?? "USER",
      },
    }),
    basePrisma.account.create({
      data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash },
    }),
  ]);
  if ((input.role ?? "USER") === "USER") await provisionNewUser(id);
  return { id, username };
}

function invalidUsername(): never {
  throw invalid("Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah", {
    username: ["Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah"],
  });
}

/** Ganti password akun lalu cabut semua sesinya (user harus login ulang). */
export async function setAccountPassword(userId: string, password: string): Promise<void> {
  if (password.length < 8 || password.length > 128) throw invalid("Password 8–128 karakter");
  const passwordHash = await hashPassword(password);
  await basePrisma.$transaction(async (tx) => {
    const acc = await tx.account.findFirst({ where: { userId, providerId: "credential" } });
    if (acc) await tx.account.update({ where: { id: acc.id }, data: { password: passwordHash } });
    else
      await tx.account.create({
        data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash },
      });
    await tx.session.deleteMany({ where: { userId } });
  });
}
