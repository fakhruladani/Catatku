/** Perilaku buku kas end-to-end di level service (DB asli). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as budgetService from "@/features/budgets/service";
import * as categoryService from "@/features/categories/service";
import * as preferenceService from "@/features/preferences/service";
import * as recapService from "@/features/recap/service";
import * as tx from "@/features/transactions/service";
import { basePrisma, createTestUser, resetDb } from "../support/db";

type Ctx = Awaited<ReturnType<typeof createTestUser>>;
let U: Ctx;
let makan: string;
let makanLuar: string;
let gaji: string;

beforeAll(async () => {
  await resetDb();
  U = await createTestUser("Uji");
  const cats = await categoryService.listCategories(U);
  const m = cats.find((c) => c.name === "Makan & Minum")!;
  makan = m.id;
  makanLuar = m.children.find((c) => c.name === "Makan di luar")!.id;
  gaji = cats.find((c) => c.name === "Gaji")!.id;
  await preferenceService.updatePreferences(U, { openingBalance: 1_000_000n, financialMonthStartDay: 25 });
});
afterAll(() => basePrisma.$disconnect());

describe("sheet bulanan dengan tanggal awal bulan 25", () => {
  it("saldo awal periode = saldo awal + semua transaksi sebelumnya; baris masuk ke tab yang benar", async () => {
    await tx.applyPaste(U, {
      updates: [],
      creates: [
        { date: "2026-09-20", type: "EXPENSE", amount: 100_000n, description: "periode Sep", categoryId: makanLuar },
        { date: "2026-09-25", type: "INCOME", amount: 10_000_000n, description: "Gaji", categoryId: gaji },
        { date: "2026-10-01", type: "EXPENSE", amount: 50_000n, description: "Makan", categoryId: makanLuar },
        { date: "2026-10-24", type: "EXPENSE", amount: 30_000n, description: "Akhir periode", categoryId: makan },
        { date: "2026-10-25", type: "EXPENSE", amount: 999n, description: "periode Nov", categoryId: null },
      ],
    });
    const okt = await tx.getSheet(U, { periodKey: "2026-10" });
    expect(okt.period).toEqual({ key: "2026-10", start: "2026-09-25", end: "2026-10-24" });
    expect(okt.openingBalance).toBe(900_000n);
    expect(okt.rows.map((r) => r.description)).toEqual(["Gaji", "Makan", "Akhir periode"]);
    expect(okt.totals).toEqual({ income: 10_000_000n, expense: 80_000n, net: 9_920_000n });
    expect(okt.closingBalance).toBe(10_820_000n);

    const nov = await tx.getSheet(U, { periodKey: "2026-11" });
    expect(nov.openingBalance).toBe(okt.closingBalance);
    expect(nov.rows).toHaveLength(1);

    const tabs = await tx.getYearTabs(U, { year: 2026 });
    expect(tabs.find((t) => t.periodKey === "2026-09")?.count).toBe(1);
    expect(tabs.find((t) => t.periodKey === "2026-10")?.count).toBe(3);
  });

  it("ganti jenis transaksi mengosongkan kategori yang tidak cocok", async () => {
    const row = (await tx.getSheet(U, { periodKey: "2026-10" })).rows.find((r) => r.description === "Makan")!;
    const updated = await tx.updateTransaction(U, { id: row.id, type: "INCOME" });
    expect(updated.categoryId).toBeNull();
    await tx.updateTransaction(U, { id: row.id, type: "EXPENSE", categoryId: makanLuar });
  });

  it("kategori dengan jenis berbeda ditolak", async () => {
    const row = (await tx.getSheet(U, { periodKey: "2026-10" })).rows.find((r) => r.description === "Makan")!;
    await expect(tx.updateTransaction(U, { id: row.id, categoryId: gaji })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("paste bersifat atomik: satu baris gagal = tidak ada yang tersimpan", async () => {
    const before = await basePrisma.transaction.count({ where: { userId: U.userId } });
    await expect(
      tx.applyPaste(U, {
        updates: [],
        creates: [
          { date: "2026-10-02", type: "EXPENSE", amount: 1n, description: "ok", categoryId: null },
          { date: "2026-10-02", type: "EXPENSE", amount: 1n, description: "salah", categoryId: gaji },
        ],
      }),
    ).rejects.toBeTruthy();
    expect(await basePrisma.transaction.count({ where: { userId: U.userId } })).toBe(before);
  });
});

describe("rekap & anggaran", () => {
  it("rekap bulanan: subkategori dijumlah ke induk, saving rate, perbandingan", async () => {
    const r = await recapService.getMonthlyRecap(U, { periodKey: "2026-10" });
    const m = r.expenseByCategory.find((l) => l.id === makan)!;
    expect(m.total).toBe(80_000n);
    expect(m.prevTotal).toBe(100_000n);
    expect(m.change).toBe(-20);
    expect(r.savingRate).toBe(99.2);
    expect(r.top5Expense[0]!.id).toBe(makan);
  });

  it("anggaran induk mencakup subkategori & berlaku ke bulan berikutnya", async () => {
    await budgetService.setBudget(U, { categoryId: makan, periodKey: "2026-10", amount: 100_000n });
    const okt = await budgetService.getBudgetSheet(U, { periodKey: "2026-10" });
    const line = okt.lines.find((l) => l.categoryId === makan)!;
    expect(line).toMatchObject({ budget: 100_000n, spent: 80_000n, level: "warning", inherited: false });
    const nov = await budgetService.getBudgetSheet(U, { periodKey: "2026-11" });
    expect(nov.lines.find((l) => l.categoryId === makan)).toMatchObject({ budget: 100_000n, inherited: true });
    const sep = await budgetService.getBudgetSheet(U, { periodKey: "2026-09" });
    expect(sep.lines.find((l) => l.categoryId === makan)?.budget).toBe(0n);
    // anggaran hanya untuk pengeluaran
    await expect(budgetService.setBudget(U, { categoryId: gaji, periodKey: "2026-10", amount: 1n })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("rekap tahunan: pivot & saldo akhir per bulan konsisten dengan sheet", async () => {
    const y = await recapService.getYearlyRecap(U, { year: 2026 });
    const okt = y.monthly.find((m) => m.periodKey === "2026-10")!;
    const sheet = await tx.getSheet(U, { periodKey: "2026-10" });
    expect(okt.closingBalance).toBe(sheet.closingBalance);
    expect(y.expensePivot.find((p) => p.id === makan)!.months[9]).toBe(80_000n);
    expect(y.mostExpensive?.periodKey).toBe("2026-09");
  });
});
