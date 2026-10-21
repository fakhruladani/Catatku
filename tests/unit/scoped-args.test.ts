import { describe, expect, it } from "vitest";
import { createTransactionSchema } from "@/features/transactions/schemas";
import { IsolationError, OWNED_MODELS, scopeArgs } from "@/server/db/scoped";

const A = "user_a";

describe("scopeArgs (Prisma extension isolasi)", () => {
  it("menyuntikkan userId ke where pada semua operasi baca/ubah/hapus", () => {
    for (const op of [
      "findUnique",
      "findFirst",
      "findMany",
      "count",
      "aggregate",
      "groupBy",
      "update",
      "updateMany",
      "deleteMany",
      "delete",
    ]) {
      const out = scopeArgs("Transaction", op, { where: { id: "w1" }, ...(op.startsWith("update") ? { data: {} } : {}) }, A);
      expect(out.where, op).toEqual({ id: "w1", userId: A });
    }
  });

  it("menolak filter userId milik user lain di where", () => {
    expect(() => scopeArgs("Transaction", "findMany", { where: { userId: "user_b" } }, A)).toThrow(IsolationError);
    expect(scopeArgs("Transaction", "findMany", { where: { userId: A } }, A).where).toEqual({ userId: A });
  });

  it("where kosong tetap dibatasi ke user", () => {
    expect(scopeArgs("Transaction", "findMany", undefined, A).where).toEqual({ userId: A });
    expect(scopeArgs("Transaction", "count", {}, A).where).toEqual({ userId: A });
  });

  it("menimpa userId pada create / createMany", () => {
    const one = scopeArgs("Transaction", "create", { data: { name: "x", userId: "user_b" } }, A);
    expect(one.data).toEqual({ name: "x", userId: A });
    const many = scopeArgs("Category", "createMany", { data: [{ name: "a" }, { name: "b", userId: "user_b" }] }, A);
    expect(many.data).toEqual([
      { name: "a", userId: A },
      { name: "b", userId: A },
    ]);
  });

  it("melarang mengubah userId atau relasi user", () => {
    expect(() => scopeArgs("Transaction", "update", { where: { id: "w" }, data: { userId: "user_b" } }, A)).toThrow(IsolationError);
    expect(() => scopeArgs("Transaction", "updateMany", { where: {}, data: { userId: "user_b" } }, A)).toThrow(IsolationError);
    expect(() => scopeArgs("Transaction", "create", { data: { user: { connect: { id: "user_b" } } } }, A)).toThrow(IsolationError);
  });

  it("upsert: where & create ter-scope, update tidak boleh memindah userId", () => {
    expect(() =>
      scopeArgs("UserPreference", "upsert", { where: { userId: "user_b" }, create: {}, update: {} }, A),
    ).toThrow(IsolationError);
    const out = scopeArgs("UserPreference", "upsert", { where: {}, create: { userId: "user_b" }, update: {} }, A);
    expect(out.where).toEqual({ userId: A });
    expect(out.create).toEqual({ userId: A });
    expect(() =>
      scopeArgs("UserPreference", "upsert", { where: {}, create: {}, update: { userId: "user_b" } }, A),
    ).toThrow(IsolationError);
  });

  it("menolak model non-user dan operasi tak dikenal (fail-closed)", () => {
    expect(() => scopeArgs("User", "findMany", {}, A)).toThrow(IsolationError);
    expect(() => scopeArgs("Session", "findMany", {}, A)).toThrow(IsolationError);
    expect(() => scopeArgs("Account", "findMany", {}, A)).toThrow(IsolationError);
    expect(() => scopeArgs("Transaction", "somethingNew", {}, A)).toThrow(IsolationError);
    expect(() => scopeArgs("Transaction", "findMany", {}, "")).toThrow(IsolationError);
  });

  it("daftar model milik user lengkap (setiap model dengan kolom userId kecuali tabel auth)", () => {
    expect([...OWNED_MODELS].sort()).toEqual(["Budget", "Category", "Transaction", "UserPreference"]);
  });
});

describe("skema input tidak menerima userId", () => {
  it("field userId dari request di-strip oleh Zod", () => {
    const parsed = createTransactionSchema.parse({
      date: "2026-10-21",
      type: "EXPENSE",
      amount: "1.000",
      description: "x",
      userId: "user_b",
    });
    expect("userId" in parsed).toBe(false);
  });
});
