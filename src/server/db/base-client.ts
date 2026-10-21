import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma Client MENTAH tanpa filter user.
 * HANYA boleh diimpor oleh src/server/auth/** dan src/server/db/** (dipaksa ESLint).
 * Kode fitur wajib memakai forUser(userId) dari ./scoped.
 */

const globalForPrisma = globalThis as unknown as { __catatkuPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diset");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const basePrisma: PrismaClient = globalForPrisma.__catatkuPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__catatkuPrisma = basePrisma;
