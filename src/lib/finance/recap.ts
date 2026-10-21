/**
 * Rekap per kategori, pivot tahunan, dan status anggaran (fungsi murni).
 * Subkategori dijumlahkan ke induknya (rollup) dan juga tersedia rinciannya.
 */
import { type EntryType, pctOf, totalsOf, type Totals } from "./cashbook";

export interface CatInfo {
  id: string;
  name: string;
  type: EntryType;
  parentId: string | null;
  color: string;
  icon: string;
}

export interface TxLite {
  type: EntryType;
  amount: bigint;
  categoryId: string | null;
  periodKey: string;
}

export const UNCATEGORIZED = "__none__";

export interface CategoryLine {
  id: string; // id induk atau UNCATEGORIZED
  name: string;
  color: string;
  icon: string;
  type: EntryType;
  total: bigint;
  pct: number; // porsi terhadap total tipe yang sama
  children: { id: string; name: string; total: bigint }[];
}

/** Id kategori induk (rollup). Kategori tak dikenal/kosong -> UNCATEGORIZED. */
export function rootOf(categoryId: string | null, cats: Map<string, CatInfo>): string {
  if (!categoryId) return UNCATEGORIZED;
  const c = cats.get(categoryId);
  if (!c) return UNCATEGORIZED;
  return c.parentId && cats.has(c.parentId) ? c.parentId : c.id;
}

export function byCategory(rows: readonly TxLite[], type: EntryType, cats: Map<string, CatInfo>): CategoryLine[] {
  const filtered = rows.filter((r) => r.type === type);
  const total = filtered.reduce((s, r) => s + r.amount, 0n);
  const lines = new Map<string, CategoryLine>();
  for (const r of filtered) {
    const rootId = rootOf(r.categoryId, cats);
    let line = lines.get(rootId);
    if (!line) {
      const c = cats.get(rootId);
      line = {
        id: rootId,
        name: c?.name ?? "Tanpa kategori",
        color: c?.color ?? "#a3a3a3",
        icon: c?.icon ?? "tag",
        type,
        total: 0n,
        pct: 0,
        children: [],
      };
      lines.set(rootId, line);
    }
    line.total += r.amount;
    if (r.categoryId && r.categoryId !== rootId && cats.has(r.categoryId)) {
      const child = line.children.find((x) => x.id === r.categoryId);
      if (child) child.total += r.amount;
      else line.children.push({ id: r.categoryId, name: cats.get(r.categoryId)!.name, total: r.amount });
    }
  }
  const out = [...lines.values()];
  for (const l of out) {
    l.pct = pctOf(l.total, total);
    l.children.sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
  }
  return out.sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
}

export interface PivotRow {
  id: string;
  name: string;
  color: string;
  type: EntryType;
  months: bigint[]; // sesuai urutan `periods`
  total: bigint;
  average: bigint; // rata-rata per periode yang sudah berjalan
}

/** Pivot kategori (induk) × periode. `elapsed` = jumlah periode yang dihitung untuk rata-rata. */
export function pivot(
  rows: readonly TxLite[],
  type: EntryType,
  periods: readonly string[],
  cats: Map<string, CatInfo>,
  elapsed: number,
): PivotRow[] {
  const idx = new Map(periods.map((p, i) => [p, i]));
  const map = new Map<string, PivotRow>();
  for (const r of rows) {
    if (r.type !== type) continue;
    const i = idx.get(r.periodKey);
    if (i === undefined) continue;
    const rootId = rootOf(r.categoryId, cats);
    let row = map.get(rootId);
    if (!row) {
      const c = cats.get(rootId);
      row = {
        id: rootId,
        name: c?.name ?? "Tanpa kategori",
        color: c?.color ?? "#a3a3a3",
        type,
        months: periods.map(() => 0n),
        total: 0n,
        average: 0n,
      };
      map.set(rootId, row);
    }
    row.months[i]! += r.amount;
    row.total += r.amount;
  }
  const div = BigInt(Math.max(1, elapsed));
  const out = [...map.values()];
  for (const r of out) r.average = r.total / div;
  return out.sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));
}

export function totalsByPeriod(rows: readonly TxLite[], periods: readonly string[]): Totals[] {
  return periods.map((p) => totalsOf(rows.filter((r) => r.periodKey === p)));
}

export type BudgetLevel = "ok" | "warning" | "over";

export interface BudgetStatus {
  budget: bigint;
  spent: bigint;
  remaining: bigint;
  pct: number;
  level: BudgetLevel;
}

/** Peringatan di 80% dan 100% (spesifikasi modul Anggaran). */
export function budgetStatus(budget: bigint, spent: bigint): BudgetStatus {
  const pct = budget > 0n ? pctOf(spent, budget) : spent > 0n ? 100 : 0;
  const level: BudgetLevel = budget > 0n && spent >= budget ? "over" : budget > 0n && pct >= 80 ? "warning" : "ok";
  return { budget, spent, remaining: budget - spent, pct, level };
}

/** Nominal anggaran yang berlaku di periode P: entri effectiveFrom terbesar yang <= P. */
export function effectiveBudget(entries: readonly { effectiveFrom: string; amount: bigint }[], period: string): bigint {
  let best: { effectiveFrom: string; amount: bigint } | null = null;
  for (const e of entries) {
    if (e.effectiveFrom <= period && (!best || e.effectiveFrom > best.effectiveFrom)) best = e;
  }
  return best?.amount ?? 0n;
}
