import "server-only";
import type { z } from "zod";
import { listCategories, type CategoryDto } from "@/features/categories/service";
import { getPreferences } from "@/features/preferences/service";
import { type EntryType, totalsOf } from "@/lib/finance/cashbook";
import {
  fromDbDate,
  getPeriodKeyForDate,
  getPeriodRange,
  periodKey as makePeriodKey,
  type PeriodRange,
  toDbDate,
} from "@/lib/period";
import type { UserCtx } from "@/server/auth/session";
import { invalid, notFound } from "@/server/errors";
import type {
  applyPasteSchema,
  CreateTransactionInput,
  deleteTransactionsSchema,
  UpdateTransactionInput,
} from "./schemas";

export interface TxRowDto {
  id: string;
  date: string; // YYYY-MM-DD
  type: EntryType;
  amount: bigint;
  description: string;
  categoryId: string | null;
  seq: number;
}

export interface SheetDto {
  period: PeriodRange;
  startDay: number;
  /** Saldo sebelum baris pertama periode ini */
  openingBalance: bigint;
  rows: TxRowDto[];
  totals: { income: bigint; expense: bigint; net: bigint };
  closingBalance: bigint;
  categories: CategoryDto[];
}

const toDto = (t: {
  id: string;
  date: Date;
  type: EntryType;
  amount: bigint;
  description: string;
  categoryId: string | null;
  seq: number;
}): TxRowDto => ({
  id: t.id,
  date: fromDbDate(t.date),
  type: t.type,
  amount: t.amount,
  description: t.description,
  categoryId: t.categoryId,
  seq: t.seq,
});

/** Saldo kas sebelum tanggal `beforeDate` (saldo awal + seluruh transaksi sebelumnya). */
export async function balanceBefore(ctx: UserCtx, beforeDate: string, openingBalance?: bigint): Promise<bigint> {
  const opening = openingBalance ?? (await getPreferences(ctx)).openingBalance;
  const sums = await ctx.db.transaction.groupBy({
    by: ["type"],
    where: { date: { lt: toDbDate(beforeDate) } },
    _sum: { amount: true },
  });
  let bal = opening;
  for (const s of sums) bal += s.type === "INCOME" ? (s._sum.amount ?? 0n) : -(s._sum.amount ?? 0n);
  return bal;
}

/** Data satu tab bulan (sheet). */
export async function getSheet(ctx: UserCtx, input: { periodKey: string }): Promise<SheetDto> {
  const pref = await getPreferences(ctx);
  const period = getPeriodRange(input.periodKey, pref.financialMonthStartDay);
  const [openingBalance, rows, categories] = await Promise.all([
    balanceBefore(ctx, period.start, pref.openingBalance),
    ctx.db.transaction.findMany({
      where: { date: { gte: toDbDate(period.start), lte: toDbDate(period.end) } },
      orderBy: [{ date: "asc" }, { seq: "asc" }],
    }),
    listCategories(ctx, { includeArchived: true }),
  ]);
  const totals = totalsOf(rows);
  return {
    period,
    startDay: pref.financialMonthStartDay,
    openingBalance,
    rows: rows.map(toDto),
    totals,
    closingBalance: openingBalance + totals.net,
    categories,
  };
}

/** Jumlah baris per tab bulan dalam satu tahun buku (untuk penanda di tab). */
export async function getYearTabs(ctx: UserCtx, input: { year: number }): Promise<{ periodKey: string; count: number }[]> {
  const pref = await getPreferences(ctx);
  const keys = Array.from({ length: 12 }, (_, i) => makePeriodKey(input.year, i + 1));
  const first = getPeriodRange(keys[0]!, pref.financialMonthStartDay);
  const last = getPeriodRange(keys[11]!, pref.financialMonthStartDay);
  const groups = await ctx.db.transaction.groupBy({
    by: ["date"],
    where: { date: { gte: toDbDate(first.start), lte: toDbDate(last.end) } },
    _count: { _all: true },
  });
  const counts = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const g of groups) {
    const k = getPeriodKeyForDate(fromDbDate(g.date), pref.financialMonthStartDay);
    counts.set(k, (counts.get(k) ?? 0) + g._count._all);
  }
  return keys.map((k) => ({ periodKey: k, count: counts.get(k) ?? 0 }));
}

type CatIndex = Map<string, { type: EntryType; archived: boolean }>;

async function categoryIndex(ctx: UserCtx): Promise<CatIndex> {
  const cats = await ctx.db.category.findMany({ select: { id: true, type: true, archivedAt: true } });
  return new Map(cats.map((c) => [c.id, { type: c.type, archived: c.archivedAt !== null }]));
}

/** Validasi kategori: milik user, aktif, dan jenisnya sama dengan jenis transaksi. */
function checkCategory(idx: CatIndex, categoryId: string | null, type: EntryType, allowArchivedId?: string | null) {
  if (!categoryId) return;
  const c = idx.get(categoryId);
  if (!c) throw notFound("Kategori");
  if (c.type !== type) {
    throw invalid(`Kategori ini untuk ${c.type === "INCOME" ? "pemasukan" : "pengeluaran"}, tidak cocok dengan jenis transaksi`);
  }
  if (c.archived && categoryId !== allowArchivedId) throw invalid("Kategori sudah diarsipkan");
}

export async function createTransaction(ctx: UserCtx, input: CreateTransactionInput): Promise<TxRowDto> {
  const idx = await categoryIndex(ctx);
  checkCategory(idx, input.categoryId, input.type);
  const t = await ctx.db.transaction.create({
    data: {
      userId: ctx.userId,
      date: toDbDate(input.date),
      type: input.type,
      amount: input.amount,
      description: input.description,
      categoryId: input.categoryId,
    },
  });
  return toDto(t);
}

type Writer = UserCtx["db"] | Parameters<Parameters<UserCtx["db"]["$transaction"]>[0]>[0];

async function applyUpdate(db: Writer, idx: CatIndex, input: UpdateTransactionInput): Promise<TxRowDto> {
  const current = await db.transaction.findFirst({ where: { id: input.id } });
  if (!current) throw notFound("Transaksi");
  const type = input.type ?? current.type;
  let categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId;
  // Jenis berubah dan kategori lama tidak cocok -> kosongkan kategori (bukan error)
  if (input.categoryId === undefined && categoryId && idx.get(categoryId)?.type !== type) categoryId = null;
  checkCategory(idx, categoryId, type, current.categoryId);
  const t = await db.transaction.update({
    where: { id: input.id },
    data: {
      ...(input.date ? { date: toDbDate(input.date) } : {}),
      type,
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      categoryId,
    },
  });
  return toDto(t);
}

export async function updateTransaction(ctx: UserCtx, input: UpdateTransactionInput): Promise<TxRowDto> {
  const idx = await categoryIndex(ctx);
  return applyUpdate(ctx.db, idx, input);
}

export async function deleteTransactions(
  ctx: UserCtx,
  input: z.output<typeof deleteTransactionsSchema>,
): Promise<{ deleted: number }> {
  const res = await ctx.db.transaction.deleteMany({ where: { id: { in: input.ids } } });
  if (res.count === 0) throw notFound("Transaksi");
  return { deleted: res.count };
}

/** Paste dari Excel: semua perubahan dalam satu transaksi DB (semua berhasil atau tidak sama sekali). */
export async function applyPaste(
  ctx: UserCtx,
  input: z.output<typeof applyPasteSchema>,
): Promise<{ updated: number; created: number }> {
  const idx = await categoryIndex(ctx);
  for (const c of input.creates) checkCategory(idx, c.categoryId, c.type);
  return ctx.db.$transaction(async (tx) => {
    for (const u of input.updates) await applyUpdate(tx, idx, u);
    if (input.creates.length > 0) {
      await tx.transaction.createMany({
        data: input.creates.map((c) => ({
          userId: ctx.userId,
          date: toDbDate(c.date),
          type: c.type,
          amount: c.amount,
          description: c.description,
          categoryId: c.categoryId,
        })),
      });
    }
    return { updated: input.updates.length, created: input.creates.length };
  });
}
