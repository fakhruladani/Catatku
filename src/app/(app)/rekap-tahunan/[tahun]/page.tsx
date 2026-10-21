import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WorkbookTabs } from "@/components/shared/workbook-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IncomeExpenseChart } from "@/features/recap/components/income-expense-chart";
import { KpiCard, pct, rp } from "@/features/recap/components/ui";
import { getYearlyRecap } from "@/features/recap/service";
import type { PivotRow } from "@/lib/finance/recap";
import { formatThousands } from "@/lib/money";
import { currentPeriodKey, formatPeriodLabel, periodKey as makeKey } from "@/lib/period";
import { requireCtx } from "@/server/auth/session";
import { getPreferences } from "@/features/preferences/service";

export const metadata: Metadata = { title: "Rekap tahunan" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function PivotTable({ title, rows, totals }: { title: string; rows: PivotRow[]; totals: bigint[] }) {
  const grand = totals.reduce((s, v) => s + v, 0n);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 sm:px-4">
        <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 border-b bg-card px-2 py-2 text-left font-medium">Kategori</th>
              {MONTHS.map((m) => (
                <th key={m} className="border-b px-2 py-2 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="border-b px-2 py-2 text-right font-semibold text-foreground">Total</th>
              <th className="border-b px-2 py-2 text-right font-medium">Rata²/bln</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={15} className="px-2 py-4 text-center text-muted-foreground">
                  Belum ada data.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="sticky left-0 border-b border-border/50 bg-card px-2 py-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                    {r.name}
                  </span>
                </td>
                {r.months.map((v, i) => (
                  <td key={i} className={`border-b border-border/50 px-2 py-1.5 text-right tabular-nums ${v === 0n ? "text-muted-foreground/50" : ""}`}>
                    {v === 0n ? "–" : formatThousands(v)}
                  </td>
                ))}
                <td className="border-b border-border/50 px-2 py-1.5 text-right font-semibold tabular-nums">{formatThousands(r.total)}</td>
                <td className="border-b border-border/50 px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                  {formatThousands(r.average)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-semibold">
            <tr>
              <td className="sticky left-0 bg-card px-2 py-2">Total</td>
              {totals.map((v, i) => (
                <td key={i} className="px-2 py-2 text-right tabular-nums">
                  {formatThousands(v)}
                </td>
              ))}
              <td className="px-2 py-2 text-right tabular-nums">{formatThousands(grand)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

async function Recap({ year }: { year: number }) {
  const ctx = await requireCtx();
  const [r, pref] = await Promise.all([getYearlyRecap(ctx, { year }), getPreferences(ctx)]);
  const cur = currentPeriodKey(pref.financialMonthStartDay);
  const contextKey = cur.startsWith(`${year}-`) ? cur : makeKey(year, 12);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Rekap Tahun {year}</h1>
          <p className="text-xs text-muted-foreground">
            Rata-rata dihitung dari {r.elapsed} bulan yang sudah berjalan
          </p>
        </div>
        <Link href={`/api/ekspor/xlsx?tahun=${year}`} prefetch={false} className="text-sm underline-offset-4 hover:underline">
          Ekspor Excel {year}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <KpiCard label="Total pemasukan" value={rp(r.totals.income)} sub={`Rata² ${rp(r.averageMonthlyIncome)}/bln`} />
        <KpiCard label="Total pengeluaran" value={rp(r.totals.expense)} sub={`Rata² ${rp(r.averageMonthlyExpense)}/bln`} />
        <KpiCard label="Selisih" value={rp(r.totals.net)} tone={r.totals.net < 0n ? "text-rose-600" : ""} />
        <KpiCard label="Saving rate" value={pct(r.savingRate)} />
        <KpiCard
          label="Bulan paling boros"
          value={r.mostExpensive ? formatPeriodLabel(r.mostExpensive.periodKey).split(" ")[0] : "—"}
          sub={r.mostExpensive ? rp(r.mostExpensive.expense) : undefined}
        />
        <KpiCard
          label="Saldo akhir tahun"
          value={rp(r.closingBalance)}
          sub={`Awal tahun ${rp(r.openingBalance)}`}
          tone={r.closingBalance < 0n ? "text-rose-600" : ""}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pemasukan vs pengeluaran per bulan</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeExpenseChart
            data={r.monthly.map((m, i) => ({ label: MONTHS[i]!, income: m.income.toString(), expense: m.expense.toString() }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ringkasan per bulan</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:px-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-2 text-left font-medium">Bulan</th>
                <th className="px-2 py-2 text-right font-medium">Pemasukan</th>
                <th className="px-2 py-2 text-right font-medium">Pengeluaran</th>
                <th className="px-2 py-2 text-right font-medium">Selisih</th>
                <th className="px-2 py-2 text-right font-medium">Saving rate</th>
                <th className="px-2 py-2 text-right font-medium">Saldo akhir</th>
              </tr>
            </thead>
            <tbody>
              {r.monthly.map((m, i) => (
                <tr key={m.periodKey} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="px-2 py-1.5">
                    <Link className="hover:underline" href={`/buku/${m.periodKey}`}>
                      {MONTHS[i]}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatThousands(m.income)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatThousands(m.expense)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${m.net < 0n ? "text-rose-600" : ""}`}>{formatThousands(m.net)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{pct(m.savingRate)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${m.closingBalance < 0n ? "text-rose-600" : ""}`}>
                    {formatThousands(m.closingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <PivotTable title="Pengeluaran per kategori × bulan" rows={r.expensePivot} totals={r.monthly.map((m) => m.expense)} />
      <PivotTable title="Pemasukan per kategori × bulan" rows={r.incomePivot} totals={r.monthly.map((m) => m.income)} />
      <WorkbookTabs kind="tahunan" periodKey={contextKey} />
    </div>
  );
}

async function Content({ params }: { params: Promise<{ tahun: string }> }) {
  const { tahun } = await params;
  const year = Number(tahun);
  if (!/^\d{4}$/.test(tahun) || year < 2000 || year > 2100) notFound();
  return <Recap year={year} />;
}

export default function RekapTahunanPage(props: PageProps<"/rekap-tahunan/[tahun]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[70dvh] w-full" />}>
      <Content params={props.params} />
    </Suspense>
  );
}
