import { basePrisma } from "@/server/db/base-client";
import { forUser } from "@/server/db/scoped";
import { provisionNewUser } from "@/server/provision";
import type { UserCtx } from "@/server/auth/session";

export async function resetDb() {
  const tables = await basePrisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await basePrisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;
export async function createTestUser(name: string): Promise<UserCtx & { email: string }> {
  counter += 1;
  const id = `test_${name.toLowerCase()}_${Date.now()}_${counter}`;
  const email = `${name.toLowerCase()}_${counter}_${Date.now()}@test.local`;
  await basePrisma.user.create({ data: { id, name, email, emailVerified: true } });
  await provisionNewUser(id);
  return { userId: id, db: forUser(id), email };
}

export { basePrisma };
