import { describe, expect, it } from "vitest";
import { compareRows, pctChange, runningBalances, savingRate, totalsOf } from "@/lib/finance/cashbook";
import {
  budgetStatus,
  byCategory,
  type CatInfo,
  effectiveBudget,
  pivot,
  totalsByPeriod,
  UNCATEGORIZED,
} from "@/lib/finance/recap";

const cats = new Map<string, CatInfo>(
  [
    { id: "makan", name: "Makan", type: "EXPENSE", parentId: null },
    { id: "makan-luar", name: "Makan di luar", type: "EXPENSE", parentId: "makan" },
    { id: "kopi", name: "Kopi", type: "EXPENSE", parentId: "makan" },
    { id: "transport", name: "Transport", type: "EXPENSE", parentId: null },
    { id: "gaji", name: "Gaji", type: "INCOME", parentId: null },
  ].map((c) => [c.id, { ...c, color: "#000000", icon: "tag" } as CatInfo]),
);

describe("totals & saldo berjalan", () => {
  it("menjumlah pemasukan, pengeluaran, dan selisih", () => {
    expect(
      totalsOf([
        { type: "INCOME", amount: 5_000_000n },
        { type: "EXPENSE", amount: 1_250_000n },
        { type: "EXPENSE", amount: 250_000n },
      ]),
    ).toEqual({ income: 5_000_000n, expense: 1_500_000n, net: 3_500_000n });
  });

  it("saldo berjalan dimulai dari saldo awal periode", () => {
    expect(
      runningBalances(100_000n, [
        { type: "EXPENSE", amount: 50_000n },
        { type: "INCOME", amount: 1_000_000n },
        { type: "EXPENSE", amount: 1_200_000n },
      ]),
    ).toEqual([50_000n, 1_050_000n, -150_000n]);
  });

  it("urutan baris: tanggal lalu urutan input", () => {
    const rows = [
      { date: "2026-10-02", seq: 1 },
      { date: "2026-10-01", seq: 9 },
      { date: "2026-10-01", seq: 3 },
    ];
    expect(rows.sort(compareRows).map((r) => r.seq)).toEqual([3, 9, 1]);
  });
});

describe("saving rate (aturan #7)", () => {
  it("dihitung (masuk − keluar) / masuk", () => {
    expect(savingRate(10_000_000n, 7_500_000n)).toBe(25);
    expect(savingRate(3_000_000n, 1_000_000n)).toBe(66.6);
    expect(savingRate(1_000_000n, 1_500_000n)).toBe(-50);
  });
  it("tidak terdefinisi jika tidak ada pemasukan", () => {
    expect(savingRate(0n, 500_000n)).toBeNull();
  });
  it("pctChange", () => {
    expect(pctChange(150n, 100n)).toBe(50);
    expect(pctChange(50n, 100n)).toBe(-50);
    expect(pctChange(10n, 0n)).toBeNull();
  });
});

describe("rekap per kategori", () => {
  const rows = [
    { type: "EXPENSE" as const, amount: 30_000n, categoryId: "makan-luar", periodKey: "2026-10" },
    { type: "EXPENSE" as const, amount: 20_000n, categoryId: "kopi", periodKey: "2026-10" },
    { type: "EXPENSE" as const, amount: 10_000n, categoryId: "makan", periodKey: "2026-10" },
    { type: "EXPENSE" as const, amount: 40_000n, categoryId: "transport", periodKey: "2026-10" },
    { type: "EXPENSE" as const, amount: 100_000n, categoryId: null, periodKey: "2026-10" },
    { type: "INCOME" as const, amount: 9_000_000n, categoryId: "gaji", periodKey: "2026-10" },
  ];

  it("subkategori dijumlahkan ke induk, diurutkan terbesar, dengan porsi %", () => {
    const lines = byCategory(rows, "EXPENSE", cats);
    expect(lines.map((l) => [l.id, l.total])).toEqual([
      [UNCATEGORIZED, 100_000n],
      ["makan", 60_000n],
      ["transport", 40_000n],
    ]);
    const makan = lines.find((l) => l.id === "makan")!;
    expect(makan.pct).toBe(30);
    expect(makan.children).toEqual([
      { id: "makan-luar", name: "Makan di luar", total: 30_000n },
      { id: "kopi", name: "Kopi", total: 20_000n },
    ]);
    expect(lines.reduce((s, l) => s + l.total, 0n)).toBe(200_000n);
  });

  it("pivot tahunan & total per periode", () => {
    const periods = ["2026-09", "2026-10"];
    const all = [...rows, { type: "EXPENSE" as const, amount: 5_000n, categoryId: "kopi", periodKey: "2026-09" }];
    const pv = pivot(all, "EXPENSE", periods, cats, 2);
    const makan = pv.find((r) => r.id === "makan")!;
    expect(makan.months).toEqual([5_000n, 60_000n]);
    expect(makan.total).toBe(65_000n);
    expect(makan.average).toBe(32_500n);
    expect(totalsByPeriod(all, periods)).toEqual([
      { income: 0n, expense: 5_000n, net: -5_000n },
      { income: 9_000_000n, expense: 200_000n, net: 8_800_000n },
    ]);
  });
});

describe("anggaran", () => {
  it("status ok / peringatan 80% / lewat 100%", () => {
    expect(budgetStatus(1_000_000n, 500_000n)).toMatchObject({ level: "ok", pct: 50, remaining: 500_000n });
    expect(budgetStatus(1_000_000n, 800_000n).level).toBe("warning");
    expect(budgetStatus(1_000_000n, 1_000_000n).level).toBe("over");
    expect(budgetStatus(1_000_000n, 1_200_000n)).toMatchObject({ level: "over", remaining: -200_000n, pct: 120 });
    expect(budgetStatus(0n, 0n).level).toBe("ok");
  });

  it("nominal berlaku = entri effectiveFrom terbaru yang <= periode", () => {
    const entries = [
      { effectiveFrom: "2026-03", amount: 1_000_000n },
      { effectiveFrom: "2026-07", amount: 1_500_000n },
      { effectiveFrom: "2026-09", amount: 0n },
    ];
    expect(effectiveBudget(entries, "2026-02")).toBe(0n);
    expect(effectiveBudget(entries, "2026-05")).toBe(1_000_000n);
    expect(effectiveBudget(entries, "2026-08")).toBe(1_500_000n);
    expect(effectiveBudget(entries, "2026-10")).toBe(0n);
  });
});
