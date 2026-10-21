import "server-only";
import { getBudgetSheet, type BudgetLine } from "@/features/budgets/service";
import { getPreferences } from "@/features/preferences/service";
import { balanceBefore } from "@/features/transactions/service";
import { pctChange, savingRate, totalsOf, type Totals } from "@/lib/finance/cashbook";
import {
  byCategory,
  type CategoryLine,
  type CatInfo,
  pivot,
  type PivotRow,
  totalsByPeriod,
  type TxLite,
} from "@/lib/finance/recap";
import {
  currentPeriodKey,
  fromDbDate,
  getPeriodKeyForDate,
  getPeriodRange,
  periodKey as makePeriodKey,
  type PeriodRange,
  shiftPeriod,
  toDbDate,
} from "@/lib/period";
import type { UserCtx } from "@/server/auth/session";

async function catMap(ctx: UserCtx): Promise<Map<string, CatInfo>> {
  const cats = await ctx.db.category.findMany({
    select: { id: true, name: true, type: true, parentId: true, color: true, icon: true },
  });
  return new Map(cats.map((c) => [c.id, c]));
}

async function rowsBetween(ctx: UserCtx, start: string, end: string, startDay: number): Promise<TxLite[]> {
  const rows = await ctx.db.transaction.findMany({
    where: { date: { gte: toDbDate(start), lte: toDbDate(end) } },
    select: { type: true, amount: true, categoryId: true, date: true },
  });
  return rows.map((r) => ({
    type: r.type,
    amount: r.amount,
    categoryId: r.categoryId,
    periodKey: getPeriodKeyForDate(fromDbDate(r.date), startDay),
  }));
}

export interface MonthlyRecapDto {
  period: PeriodRange;
  prevPeriod: PeriodRange;
  totals: Totals;
  prevTotals: Totals;
  change: { income: number | null; expense: number | null; net: number | null };
  savingRate: number | null;
  prevSavingRate: number | null;
  openingBalance: bigint;
  closingBalance: bigint;
  expenseByCategory: (CategoryLine & { prevTotal: bigint; change: number | null })[];
  incomeByCategory: CategoryLine[];
  top5Expense: CategoryLine[];
  budgets: BudgetLine[];
  transactionCount: number;
}

export async function getMonthlyRecap(ctx: UserCtx, input: { periodKey: string }): Promise<MonthlyRecapDto> {
  const pref = await getPreferences(ctx);
  const sd = pref.financialMonthStartDay;
  const period = getPeriodRange(input.periodKey, sd);
  const prevPeriod = getPeriodRange(shiftPeriod(input.periodKey, -1), sd);
  const [cats, rows, openingBalance, budget] = await Promise.all([
    catMap(ctx),
    rowsBetween(ctx, prevPeriod.start, period.end, sd),
    balanceBefore(ctx, period.start, pref.openingBalance),
    getBudgetSheet(ctx, { periodKey: input.periodKey }),
  ]);
  const cur = rows.filter((r) => r.periodKey === period.key);
  const prev = rows.filter((r) => r.periodKey === prevPeriod.key);
  const totals = totalsOf(cur);
  const prevTotals = totalsOf(prev);
  const prevByCat = new Map(byCategory(prev, "EXPENSE", cats).map((l) => [l.id, l.total]));
  const expenseByCategory = byCategory(cur, "EXPENSE", cats).map((l) => {
    const p = prevByCat.get(l.id) ?? 0n;
    return { ...l, prevTotal: p, change: pctChange(l.total, p) };
  });
  return {
    period,
    prevPeriod,
    totals,
    prevTotals,
    change: {
      income: pctChange(totals.income, prevTotals.income),
      expense: pctChange(totals.expense, prevTotals.expense),
      net: pctChange(totals.net, prevTotals.net),
    },
    savingRate: savingRate(totals.income, totals.expense),
    prevSavingRate: savingRate(prevTotals.income, prevTotals.expense),
    openingBalance,
    closingBalance: openingBalance + totals.net,
    expenseByCategory,
    incomeByCategory: byCategory(cur, "INCOME", cats),
    top5Expense: expenseByCategory.slice(0, 5),
    budgets: budget.lines.filter((l) => l.budget > 0n),
    transactionCount: cur.length,
  };
}

export interface YearlyRecapDto {
  year: number;
  periods: string[];
  /** Jumlah periode yang sudah dimulai (untuk rata-rata) */
  elapsed: number;
  monthly: (Totals & { periodKey: string; closingBalance: bigint; savingRate: number | null })[];
  expensePivot: PivotRow[];
  incomePivot: PivotRow[];
  totals: Totals;
  savingRate: number | null;
  openingBalance: bigint;
  closingBalance: bigint;
  averageMonthlyExpense: bigint;
  averageMonthlyIncome: bigint;
  mostExpensive: { periodKey: string; expense: bigint } | null;
}

export async function getYearlyRecap(ctx: UserCtx, input: { year: number }): Promise<YearlyRecapDto> {
  const pref = await getPreferences(ctx);
  const sd = pref.financialMonthStartDay;
  const periods = Array.from({ length: 12 }, (_, i) => makePeriodKey(input.year, i + 1));
  const first = getPeriodRange(periods[0]!, sd);
  const last = getPeriodRange(periods[11]!, sd);
  const nowKey = currentPeriodKey(sd);
  const elapsed = periods.filter((p) => p <= nowKey).length;

  const [cats, rows, openingBalance] = await Promise.all([
    catMap(ctx),
    rowsBetween(ctx, first.start, last.end, sd),
    balanceBefore(ctx, first.start, pref.openingBalance),
  ]);
  const perPeriod = totalsByPeriod(rows, periods);
  let bal = openingBalance;
  const monthly = perPeriod.map((t, i) => {
    bal += t.net;
    return { ...t, periodKey: periods[i]!, closingBalance: bal, savingRate: savingRate(t.income, t.expense) };
  });
  const totals = totalsOf(rows);
  const div = BigInt(Math.max(1, elapsed));
  const mostExpensive = monthly.reduce<{ periodKey: string; expense: bigint } | null>(
    (best, m) => (m.expense > 0n && (!best || m.expense > best.expense) ? { periodKey: m.periodKey, expense: m.expense } : best),
    null,
  );
  return {
    year: input.year,
    periods,
    elapsed,
    monthly,
    expensePivot: pivot(rows, "EXPENSE", periods, cats, elapsed),
    incomePivot: pivot(rows, "INCOME", periods, cats, elapsed),
    totals,
    savingRate: savingRate(totals.income, totals.expense),
    openingBalance,
    closingBalance: openingBalance + totals.net,
    averageMonthlyExpense: totals.expense / div,
    averageMonthlyIncome: totals.income / div,
    mostExpensive,
  };
}
