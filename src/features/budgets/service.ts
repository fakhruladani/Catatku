import "server-only";
import { z } from "zod";
import { zPeriodKey } from "@/features/transactions/schemas";
import { getPreferences } from "@/features/preferences/service";
import { budgetStatus, type BudgetStatus, effectiveBudget } from "@/lib/finance/recap";
import { getPeriodRange, toDbDate } from "@/lib/period";
import { zId, zMoneyNonNegative } from "@/lib/validation";
import type { UserCtx } from "@/server/auth/session";
import { invalid, notFound } from "@/server/errors";

export const setBudgetSchema = z.object({
  categoryId: zId,
  periodKey: zPeriodKey,
  /** 0 = hapus anggaran mulai periode ini */
  amount: zMoneyNonNegative,
});

export interface BudgetLine extends BudgetStatus {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  parentId: string | null;
  /** Anggaran berasal dari periode sebelumnya (berlaku otomatis) */
  inherited: boolean;
}

export interface BudgetSheetDto {
  periodKey: string;
  lines: BudgetLine[]; // urut: induk lalu anak-anaknya
  total: BudgetStatus; // total dari kategori level teratas yang dianggarkan (+ anak yang induknya tanpa anggaran)
}

/**
 * Anggaran pengeluaran per kategori untuk satu periode.
 * Realisasi kategori induk = induk + semua subkategorinya.
 */
export async function getBudgetSheet(ctx: UserCtx, input: { periodKey: string }): Promise<BudgetSheetDto> {
  const pref = await getPreferences(ctx);
  const period = getPeriodRange(input.periodKey, pref.financialMonthStartDay);
  const [cats, budgets, spentRows] = await Promise.all([
    ctx.db.category.findMany({ where: { type: "EXPENSE" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ctx.db.budget.findMany({ where: { effectiveFrom: { lte: input.periodKey } } }),
    ctx.db.transaction.groupBy({
      by: ["categoryId"],
      where: { type: "EXPENSE", date: { gte: toDbDate(period.start), lte: toDbDate(period.end) } },
      _sum: { amount: true },
    }),
  ]);
  const spentDirect = new Map(spentRows.map((r) => [r.categoryId ?? "", r._sum.amount ?? 0n]));
  const byCat = new Map<string, { effectiveFrom: string; amount: bigint }[]>();
  for (const b of budgets) (byCat.get(b.categoryId) ?? byCat.set(b.categoryId, []).get(b.categoryId)!).push(b);

  const roots = cats.filter((c) => !c.parentId);
  const lines: BudgetLine[] = [];
  let totalBudget = 0n;
  let totalSpent = 0n;

  const lineFor = (c: (typeof cats)[number], spent: bigint): BudgetLine => {
    const entries = byCat.get(c.id) ?? [];
    const amount = effectiveBudget(entries, input.periodKey);
    const inherited = amount > 0n && !entries.some((e) => e.effectiveFrom === input.periodKey);
    return {
      categoryId: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      parentId: c.parentId,
      inherited,
      ...budgetStatus(amount, spent),
    };
  };

  for (const r of roots) {
    const children = cats.filter((c) => c.parentId === r.id);
    const childSpent = children.reduce((s, c) => s + (spentDirect.get(c.id) ?? 0n), 0n);
    const rootLine = lineFor(r, (spentDirect.get(r.id) ?? 0n) + childSpent);
    // Kategori diarsipkan tetap tampil bila punya anggaran/realisasi di periode ini
    const childLines = children
      .map((c) => lineFor(c, spentDirect.get(c.id) ?? 0n))
      .filter((l, i) => !children[i]!.archivedAt || l.budget > 0n || l.spent > 0n);
    if (r.archivedAt && rootLine.budget === 0n && rootLine.spent === 0n) continue;
    lines.push(rootLine, ...childLines);
    if (rootLine.budget > 0n) {
      totalBudget += rootLine.budget;
      totalSpent += rootLine.spent;
    } else {
      for (const cl of childLines) {
        if (cl.budget > 0n) {
          totalBudget += cl.budget;
          totalSpent += cl.spent;
        }
      }
    }
  }
  return { periodKey: input.periodKey, lines, total: budgetStatus(totalBudget, totalSpent) };
}

/** Set nominal anggaran mulai periode ini (berlaku juga untuk periode berikutnya sampai diubah). */
export async function setBudget(ctx: UserCtx, input: z.output<typeof setBudgetSchema>): Promise<{ categoryId: string }> {
  const cat = await ctx.db.category.findFirst({ where: { id: input.categoryId } });
  if (!cat) throw notFound("Kategori");
  if (cat.type !== "EXPENSE") throw invalid("Anggaran hanya untuk kategori pengeluaran");
  await ctx.db.budget.upsert({
    where: { userId_categoryId_effectiveFrom: { userId: ctx.userId, categoryId: input.categoryId, effectiveFrom: input.periodKey } },
    create: { userId: ctx.userId, categoryId: input.categoryId, effectiveFrom: input.periodKey, amount: input.amount },
    update: { amount: input.amount },
  });
  return { categoryId: input.categoryId };
}
