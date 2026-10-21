import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WorkbookTabs } from "@/components/shared/workbook-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetBadge, Change, InlineBar, KpiCard, pct, rp } from "@/features/recap/components/ui";
import { EXPENSE_COLOR, INCOME_COLOR } from "@/features/recap/components/income-expense-chart";
import { getMonthlyRecap } from "@/features/recap/service";
import { formatPeriodLabel, formatPeriodRange, isPeriodKey } from "@/lib/period";
import { requireCtx } from "@/server/auth/session";

export const metadata: Metadata = { title: "Rekap bulanan" };

async function Recap({ periodKey }: { periodKey: string }) {
  const ctx = await requireCtx();
  const r = await getMonthlyRecap(ctx, { periodKey });
  const prevLabel = formatPeriodLabel(r.prevPeriod.key);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Rekap {formatPeriodLabel(periodKey)}</h1>
          <p className="text-xs text-muted-foreground">
            {formatPeriodRange(r.period)} · {r.transactionCount} transaksi · dibanding {prevLabel}
          </p>
        </div>
        <Link href={`/api/ekspor/xlsx?tahun=${periodKey.slice(0, 4)}`} className="text-sm underline-offset-4 hover:underline" prefetch={false}>
          Ekspor Excel ({periodKey.slice(0, 4)})
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <KpiCard label="Pemasukan" value={rp(r.totals.income)} sub={<Change pct={r.change.income} />} />
        <KpiCard label="Pengeluaran" value={rp(r.totals.expense)} sub={<Change pct={r.change.expense} goodWhenUp={false} />} />
        <KpiCard
          label="Selisih"
          value={rp(r.totals.net)}
          tone={r.totals.net < 0n ? "text-rose-600" : ""}
          sub={<Change pct={r.change.net} />}
        />
        <KpiCard label="Saving rate" value={pct(r.savingRate)} sub={`${prevLabel}: ${pct(r.prevSavingRate)}`} />
        <KpiCard label="Saldo akhir" value={rp(r.closingBalance)} sub={`Saldo awal ${rp(r.openingBalance)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pengeluaran per kategori</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {r.expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pengeluaran di periode ini.</p>
            ) : (
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Kategori</th>
                    <th className="w-32 py-2 text-right font-medium">Jumlah</th>
                    <th className="w-28 px-3 py-2 text-left font-medium">Porsi</th>
                    <th className="w-28 py-2 text-right font-medium">{prevLabel.split(" ")[0]}</th>
                    <th className="w-20 py-2 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {r.expenseByCategory.map((l) => (
                    <FragmentRows key={l.id} line={l} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right tabular-nums">{rp(r.totals.expense)}</td>
                    <td />
                    <td className="py-2 text-right tabular-nums">{rp(r.prevTotals.expense)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 5 pengeluaran</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {r.top5Expense.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              {r.top5Expense.map((l, i) => (
                <div key={l.id} className="grid gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">
                      {i + 1}. {l.name}
                    </span>
                    <span className="tabular-nums">{rp(l.total)}</span>
                  </div>
                  <InlineBar value={l.pct} color={EXPENSE_COLOR} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pemasukan per kategori</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {r.incomeByCategory.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pemasukan.</p>}
              {r.incomeByCategory.map((l) => (
                <div key={l.id} className="grid gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{l.name}</span>
                    <span className="tabular-nums">
                      {rp(l.total)} <span className="text-xs text-muted-foreground">({l.pct.toLocaleString("id-ID")}%)</span>
                    </span>
                  </div>
                  <InlineBar value={l.pct} color={INCOME_COLOR} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status anggaran</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {r.budgets.length === 0 ? (
                <p className="text-muted-foreground">
                  Belum ada anggaran.{" "}
                  <Link className="underline" href={`/anggaran/${periodKey}`}>
                    Atur anggaran
                  </Link>
                </p>
              ) : (
                r.budgets.map((b) => (
                  <div key={b.categoryId} className="flex items-center justify-between gap-2">
                    <span className="truncate">{b.name}</span>
                    <BudgetBadge level={b.level} pct={b.pct} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <WorkbookTabs kind="rekap" periodKey={periodKey} />
    </div>
  );
}

function FragmentRows({
  line,
}: {
  line: Awaited<ReturnType<typeof getMonthlyRecap>>["expenseByCategory"][number];
}) {
  return (
    <>
      <tr className="border-b border-border/60">
        <td className="py-2">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: line.color }} aria-hidden />
            {line.name}
          </span>
        </td>
        <td className="py-2 text-right font-medium tabular-nums">{rp(line.total)}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <InlineBar value={line.pct} color={EXPENSE_COLOR} />
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{line.pct.toLocaleString("id-ID")}%</span>
          </div>
        </td>
        <td className="py-2 text-right text-muted-foreground tabular-nums">{rp(line.prevTotal)}</td>
        <td className="py-2 text-right text-xs tabular-nums">
          {line.change === null ? "—" : `${line.change > 0 ? "+" : ""}${line.change.toLocaleString("id-ID")}%`}
        </td>
      </tr>
      {line.children.map((c) => (
        <tr key={c.id} className="border-b border-border/40 text-xs text-muted-foreground">
          <td className="py-1.5 pl-6">{c.name}</td>
          <td className="py-1.5 text-right tabular-nums">{rp(c.total)}</td>
          <td colSpan={3} />
        </tr>
      ))}
    </>
  );
}

async function Content({ params }: { params: Promise<{ periode: string }> }) {
  const { periode } = await params;
  if (!isPeriodKey(periode)) notFound();
  return <Recap periodKey={periode} />;
}

export default function RekapPage(props: PageProps<"/rekap/[periode]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[70dvh] w-full" />}>
      <Content params={props.params} />
    </Suspense>
  );
}
