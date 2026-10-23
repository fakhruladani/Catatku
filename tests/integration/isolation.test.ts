/**
 * Integration test isolasi data antar-user (aturan bisnis #8 & #9).
 *
 * Skenario: user A (penyerang) memakai ID milik user B pada SETIAP service.
 * Ekspektasi: ditolak / tidak melihat apa pun, dan seluruh data B tidak berubah.
 *
 * Matriks wajib mencakup setiap fungsi yang diekspor features/<modul>/service.ts.
 * Jika ada service baru tanpa kasus isolasi, test "cakupan matriks" gagal.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as budgetService from "@/features/budgets/service";
import * as categoryService from "@/features/categories/service";
import * as onboardingService from "@/features/onboarding/service";
import * as preferenceService from "@/features/preferences/service";
import * as recapService from "@/features/recap/service";
import * as txService from "@/features/transactions/service";
import { OWNED_MODELS } from "@/server/db/scoped";
import { getOwnProfile, updateOwnProfile } from "@/server/db/self";
import { basePrisma, createTestUser, resetDb } from "../support/db";

type Ctx = Awaited<ReturnType<typeof createTestUser>>;
let A: Ctx;
let B: Ctx;
let bTxId: string;
let bTx2Id: string;
let bExpenseCatId: string;
let bIncomeCatId: string;
let aExpenseCatId: string;
const PERIOD = "2026-10";

/** Seluruh baris milik B, dibandingkan sebelum & sesudah serangan. */
async function snapshotUser(userId: string) {
  const [user, pref, categories, txs, budgets] = await Promise.all([
    basePrisma.user.findUnique({ where: { id: userId } }),
    basePrisma.userPreference.findMany({ where: { userId } }),
    basePrisma.category.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    basePrisma.transaction.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    basePrisma.budget.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  ]);
  return JSON.stringify({ user, pref, categories, txs, budgets }, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

async function expectRejected(p: Promise<unknown>) {
  await expect(p).rejects.toSatisfy((e: unknown) => {
    const err = e as { code?: string; name?: string };
    return ["NOT_FOUND", "VALIDATION", "CONFLICT", "P2003", "P2025"].includes(err.code ?? "") || err.name === "IsolationError";
  });
}

beforeAll(async () => {
  await resetDb();
  A = await createTestUser("Alice");
  B = await createTestUser("Bob");
  const bCats = await categoryService.listCategories(B);
  bExpenseCatId = bCats.find((c) => c.type === "EXPENSE")!.id;
  bIncomeCatId = bCats.find((c) => c.type === "INCOME")!.id;
  aExpenseCatId = (await categoryService.listCategories(A)).find((c) => c.type === "EXPENSE")!.id;

  ({ id: bTxId } = await txService.createTransaction(B, {
    date: "2026-10-05",
    type: "EXPENSE",
    amount: 250_000n,
    description: "Rahasia B",
    categoryId: bExpenseCatId,
  }));
  ({ id: bTx2Id } = await txService.createTransaction(B, {
    date: "2026-10-06",
    type: "INCOME",
    amount: 9_000_000n,
    description: "Gaji B",
    categoryId: bIncomeCatId,
  }));
  await budgetService.setBudget(B, { categoryId: bExpenseCatId, periodKey: PERIOD, amount: 1_000_000n });
  await preferenceService.updatePreferences(B, { openingBalance: 5_000_000n });
  await txService.createTransaction(A, {
    date: "2026-10-07",
    type: "EXPENSE",
    amount: 10_000n,
    description: "Milik A",
    categoryId: aExpenseCatId,
  });
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

const noBData = (json: unknown) => {
  const s = JSON.stringify(json, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  expect(s).not.toContain("Rahasia B");
  expect(s).not.toContain(bTxId);
  expect(s).not.toContain(bExpenseCatId);
  expect(s).not.toContain("9000000");
};

// ───────────── Matriks serangan per service ─────────────
const attacks: Record<string, () => Promise<void>> = {
  // Transaksi
  "transactions.getSheet": async () => {
    const sheet = await txService.getSheet(A, { periodKey: PERIOD });
    expect(sheet.rows.map((r) => r.description)).toEqual(["Milik A"]);
    expect(sheet.openingBalance).toBe(0n); // saldo awal B (5 jt) tidak bocor
    noBData(sheet);
  },
  "transactions.getYearTabs": async () => {
    const tabs = await txService.getYearTabs(A, { year: 2026 });
    expect(tabs.find((t) => t.periodKey === PERIOD)?.count).toBe(1);
  },
  "transactions.balanceBefore": async () => {
    expect(await txService.balanceBefore(A, "2027-01-01")).toBe(-10_000n);
  },
  "transactions.createTransaction": async () => {
    // kategori milik B ditolak
    await expectRejected(
      txService.createTransaction(A, { date: "2026-10-08", type: "EXPENSE", amount: 1n, description: "x", categoryId: bExpenseCatId }),
    );
    // userId palsu di input tidak berpengaruh
    const row = await txService.createTransaction(A, {
      date: "2026-10-08",
      type: "EXPENSE",
      amount: 1n,
      description: "sisipan",
      categoryId: null,
      ...({ userId: B.userId } as object),
    });
    expect((await basePrisma.transaction.findUnique({ where: { id: row.id } }))?.userId).toBe(A.userId);
    await txService.deleteTransactions(A, { ids: [row.id] });
  },
  "transactions.updateTransaction": async () => {
    await expectRejected(txService.updateTransaction(A, { id: bTxId, amount: 1n }));
    await expectRejected(txService.updateTransaction(A, { id: bTxId, description: "diretas" }));
  },
  "transactions.deleteTransactions": async () => {
    await expectRejected(txService.deleteTransactions(A, { ids: [bTxId, bTx2Id] }));
  },
  "transactions.applyPaste": async () => {
    await expectRejected(
      txService.applyPaste(A, { updates: [{ id: bTxId, amount: 1n, description: "paste" }], creates: [] }),
    );
    await expectRejected(
      txService.applyPaste(A, {
        updates: [],
        creates: [{ date: "2026-10-09", type: "EXPENSE", amount: 5n, description: "y", categoryId: bExpenseCatId }],
      }),
    );
  },

  // Rekap
  "recap.getMonthlyRecap": async () => {
    const r = await recapService.getMonthlyRecap(A, { periodKey: PERIOD });
    expect(r.totals.expense).toBe(10_000n);
    expect(r.totals.income).toBe(0n);
    noBData(r);
  },
  "recap.getYearlyRecap": async () => {
    const r = await recapService.getYearlyRecap(A, { year: 2026 });
    expect(r.totals).toEqual({ income: 0n, expense: 10_000n, net: -10_000n });
    noBData(r);
  },

  // Anggaran
  "budgets.getBudgetSheet": async () => {
    const s = await budgetService.getBudgetSheet(A, { periodKey: PERIOD });
    expect(s.total.budget).toBe(0n);
    noBData(s);
  },
  "budgets.setBudget": () => expectRejected(budgetService.setBudget(A, { categoryId: bExpenseCatId, periodKey: PERIOD, amount: 1n })),

  // Kategori
  "categories.listCategories": async () => {
    const tree = await categoryService.listCategories(A, { includeArchived: true });
    const ids = tree.flatMap((c) => [c.id, ...c.children.map((x) => x.id)]);
    const owners = await basePrisma.category.findMany({ where: { id: { in: ids } }, select: { userId: true } });
    expect(new Set(owners.map((o) => o.userId))).toEqual(new Set([A.userId]));
  },
  "categories.createCategory": () =>
    expectRejected(
      categoryService.createCategory(A, { name: "Anak curian", type: "EXPENSE", parentId: bExpenseCatId, icon: "tag", color: "#000000" }),
    ),
  "categories.updateCategory": () =>
    expectRejected(categoryService.updateCategory(A, { id: bExpenseCatId, name: "Diretas", icon: "tag", color: "#000000" })),
  "categories.archiveCategory": () => expectRejected(categoryService.archiveCategory(A, { id: bExpenseCatId, archived: true })),
  "categories.keepOnlyCategories": async () => {
    await categoryService.keepOnlyCategories(A, { keepIds: [bExpenseCatId, bIncomeCatId, aExpenseCatId] });
  },

  // Preferensi
  "preferences.getPreferences": async () => {
    expect((await preferenceService.getPreferences(A)).openingBalance).toBe(0n);
  },
  "preferences.updatePreferences": async () => {
    await preferenceService.updatePreferences(A, { financialMonthStartDay: 1 });
  },

  // Onboarding
  "onboarding.saveProfileStep": () => onboardingService.saveProfileStep(A, { nickname: "Ali" }).then(() => undefined),
  "onboarding.saveOpeningStep": () => onboardingService.saveOpeningStep(A, { openingBalance: 0n }).then(() => undefined),
  "onboarding.saveCategoriesStep": () => onboardingService.saveCategoriesStep(A, { keepIds: [bExpenseCatId, aExpenseCatId] }).then(() => undefined),
  "onboarding.finishOnboarding": () => onboardingService.finishOnboarding(A, { financialMonthStartDay: 1 }).then(() => undefined),
};

const SERVICE_MODULES = {
  transactions: txService,
  recap: recapService,
  budgets: budgetService,
  categories: categoryService,
  preferences: preferenceService,
  onboarding: onboardingService,
};

describe("isolasi data antar-user", () => {
  it("cakupan matriks: setiap service yang diekspor punya kasus serangan", () => {
    const exported = Object.entries(SERVICE_MODULES).flatMap(([mod, m]) =>
      Object.entries(m)
        .filter(([, v]) => typeof v === "function")
        .map(([name]) => `${mod}.${name}`),
    );
    const missing = exported.filter((k) => !(k in attacks));
    expect(missing, `Service tanpa test isolasi: ${missing.join(", ")}`).toEqual([]);
  });

  for (const [name, attack] of Object.entries(attacks)) {
    it(`${name}: A tidak bisa membaca/mengubah/menghapus data B`, async () => {
      const before = await snapshotUser(B.userId);
      await attack();
      expect(await snapshotUser(B.userId)).toEqual(before);
    });
  }
});

describe("lapisan database", () => {
  it("composite FK menolak transaksi A yang merujuk kategori B (melewati validasi aplikasi)", async () => {
    await expect(
      A.db.transaction.create({
        data: { userId: A.userId, type: "EXPENSE", amount: 1n, date: new Date("2026-10-01T00:00:00Z"), categoryId: bExpenseCatId },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("composite FK menolak jenis transaksi yang tidak cocok dengan jenis kategori", async () => {
    const incomeCat = await categoryService.createCategory(A, { name: "Masuk A", type: "INCOME", icon: "tag", color: "#000000" });
    await expect(
      A.db.transaction.create({
        data: { userId: A.userId, type: "EXPENSE", amount: 1n, date: new Date("2026-10-01T00:00:00Z"), categoryId: incomeCat.id },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("CHECK: nominal harus > 0", async () => {
    await expect(
      A.db.transaction.create({ data: { userId: A.userId, type: "EXPENSE", amount: 0n, date: new Date("2026-10-01T00:00:00Z") } }),
    ).rejects.toThrow();
  });

  it("client ter-scope menolak filter userId milik orang lain & tidak menemukan baris B", async () => {
    await expect(A.db.transaction.findMany({ where: { userId: B.userId } })).rejects.toThrow("Filter userId tidak sesuai sesi");
    expect(await A.db.transaction.findUnique({ where: { id: bTxId } })).toBeNull();
  });

  it("updateMany/deleteMany dari A tidak menyentuh B", async () => {
    const before = await snapshotUser(B.userId);
    await A.db.category.updateMany({ where: {}, data: { color: "#ffffff" } });
    await A.db.transaction.deleteMany({ where: {} });
    expect(await snapshotUser(B.userId)).toEqual(before);
  });

  it("semua tabel ber-kolom userId (selain tabel auth) terdaftar sebagai model ter-scope", async () => {
    const rows = await basePrisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'userId'`;
    const tables = rows.map((r) => r.table_name).filter((t) => !["Session", "Account", "TwoFactor"].includes(t));
    expect(tables.sort()).toEqual([...OWNED_MODELS].sort());
  });

  it("FK userId ke User = ON DELETE CASCADE di semua tabel milik user", async () => {
    const rows = await basePrisma.$queryRaw<{ table_name: string; delete_rule: string }[]>`
      SELECT tc.table_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'userId' AND rc.unique_constraint_name = 'User_pkey'`;
    const byTable = new Map(rows.map((r) => [r.table_name, r.delete_rule]));
    for (const m of OWNED_MODELS) expect(byTable.get(m), m).toBe("CASCADE");
  });
});

describe("akses profil sendiri", () => {
  it("getOwnProfile/updateOwnProfile hanya memakai userId dari ctx", async () => {
    const before = await snapshotUser(B.userId);
    await updateOwnProfile(A, { nickname: "A saja" });
    expect((await getOwnProfile(A)).nickname).toBe("A saja");
    expect(await snapshotUser(B.userId)).toEqual(before);
  });
});

describe("hapus user = cascade", () => {
  it("menghapus user menghapus seluruh datanya tanpa menyentuh user lain", async () => {
    const C = await createTestUser("Carol");
    await txService.createTransaction(C, { date: "2026-10-01", type: "INCOME", amount: 1n, description: "", categoryId: null });
    const before = await snapshotUser(B.userId);
    await basePrisma.user.delete({ where: { id: C.userId } });
    for (const t of ["transaction", "category", "userPreference", "budget"] as const) {
      // @ts-expect-error akses dinamis delegate
      expect(await basePrisma[t].count({ where: { userId: C.userId } }), t).toBe(0);
    }
    expect(await snapshotUser(B.userId)).toEqual(before);
  });
});
