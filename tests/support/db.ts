import { createAccount } from "@/server/admin/accounts";
import type { UserCtx } from "@/server/auth/session";
import { basePrisma } from "@/server/db/base-client";
import { forUser } from "@/server/db/scoped";

export async function resetDb() {
  const tables = await basePrisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await basePrisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;
export const TEST_PASSWORD = "Rahasia-Uji-123";

/** User biasa (dibuat lewat jalur yang sama dengan admin: createAccount + provisioning kategori). */
export async function createTestUser(name: string): Promise<UserCtx & { username: string }> {
  counter += 1;
  const username = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}${counter}`;
  const { id } = await createAccount({ username, name, password: TEST_PASSWORD });
  return { userId: id, db: forUser(id), username };
}

export { basePrisma };
