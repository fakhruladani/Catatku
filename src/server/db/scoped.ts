import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { basePrisma } from "./base-client";

/**
 * Isolasi data per user (aturan bisnis #8 & #9).
 *
 * forUser(userId) mengembalikan client yang:
 *  - hanya mengekspos model milik user (tidak ada User/Session/Account/raw SQL),
 *  - menyuntikkan `userId` ke setiap where (baca/ubah/hapus/agregasi),
 *  - menimpa `userId` pada setiap data create, dan melarang mengubah userId pada update,
 *  - menolak operasi yang tidak dikenal (fail-closed).
 * Lapis kedua: composite FK (xId, userId) di database menolak referensi lintas-user.
 */

export const OWNED_MODELS = ["UserPreference", "Category", "Transaction", "Budget"] as const;

const OWNED = new Set<string>(OWNED_MODELS);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);
const UPDATE_DATA_OPS = new Set(["update", "updateMany", "updateManyAndReturn"]);

export class IsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IsolationError";
  }
}

type AnyRecord = Record<string, unknown>;

function withUserData(data: unknown, userId: string): AnyRecord {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new IsolationError("Data create tidak valid");
  }
  const d = { ...(data as AnyRecord) };
  if ("user" in d) throw new IsolationError("Relasi `user` tidak boleh diisi dari kode fitur");
  d.userId = userId;
  return d;
}

function stripUserFromUpdate(data: unknown): AnyRecord {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new IsolationError("Data update tidak valid");
  }
  const d = { ...(data as AnyRecord) };
  if ("user" in d) throw new IsolationError("Relasi `user` tidak boleh diubah");
  if ("userId" in d) throw new IsolationError("userId tidak boleh diubah");
  return d;
}

function scopeWhere(where: unknown, userId: string): AnyRecord {
  const w = { ...((where as AnyRecord) ?? {}) };
  // userId milik orang lain yang disebut eksplisit = indikasi bug/serangan -> tolak, jangan diam-diam ditimpa
  if ("userId" in w && w.userId !== userId) throw new IsolationError("Filter userId tidak sesuai sesi");
  w.userId = userId;
  return w;
}

/** Transformasi argumen — diekspor untuk unit test. */
export function scopeArgs(model: string, operation: string, rawArgs: unknown, userId: string): AnyRecord {
  if (!userId) throw new IsolationError("userId kosong");
  if (!OWNED.has(model)) throw new IsolationError(`Model ${model} tidak boleh diakses lewat client user`);
  const args: AnyRecord = { ...((rawArgs as AnyRecord) ?? {}) };

  if (WHERE_OPS.has(operation)) {
    args.where = scopeWhere(args.where, userId);
    if (UPDATE_DATA_OPS.has(operation)) args.data = stripUserFromUpdate(args.data);
    return args;
  }
  if (CREATE_OPS.has(operation)) {
    const data = args.data;
    args.data = Array.isArray(data) ? data.map((d) => withUserData(d, userId)) : withUserData(data, userId);
    return args;
  }
  if (operation === "upsert") {
    args.where = scopeWhere(args.where, userId);
    args.create = withUserData(args.create, userId);
    args.update = stripUserFromUpdate(args.update);
    return args;
  }
  throw new IsolationError(`Operasi ${operation} tidak diizinkan pada client user`);
}

function scopeExtension(userId: string) {
  return Prisma.defineExtension({
    name: "catatku-user-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args, userId) as typeof args);
        },
      },
    },
  });
}

function expose<C extends ReturnType<typeof extend>>(c: C) {
  return {
    userPreference: c.userPreference,
    category: c.category,
    transaction: c.transaction,
    budget: c.budget,
  };
}

function extend(userId: string) {
  return basePrisma.$extends(scopeExtension(userId));
}

type Exposed = ReturnType<typeof expose>;
export type ScopedDb = Exposed & {
  readonly userId: string;
  /** Transaksi DB interaktif; client di dalamnya tetap ter-scope ke user yang sama. */
  $transaction<T>(fn: (tx: Exposed & { readonly userId: string }) => Promise<T>): Promise<T>;
};

export function forUser(userId: string): ScopedDb {
  if (!userId || typeof userId !== "string") throw new IsolationError("userId wajib");
  const client = extend(userId);
  return {
    ...expose(client),
    userId,
    $transaction: <T>(fn: (tx: Exposed & { readonly userId: string }) => Promise<T>) =>
      client.$transaction((tx) => fn({ ...expose(tx as unknown as typeof client), userId })),
  };
}
