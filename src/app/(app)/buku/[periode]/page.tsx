import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WorkbookTabs } from "@/components/shared/workbook-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SheetGrid } from "@/features/transactions/components/sheet-grid";
import { getSheet, getYearTabs } from "@/features/transactions/service";
import { formatRupiah } from "@/lib/money";
import { formatPeriodLabel, formatPeriodRange, isPeriodKey, parsePeriodKey, todayInJakarta } from "@/lib/period";
import { requireCtx } from "@/server/auth/session";

export async function generateMetadata(props: PageProps<"/buku/[periode]">): Promise<Metadata> {
  const { periode } = await props.params;
  return { title: isPeriodKey(periode) ? formatPeriodLabel(periode) : "Buku kas" };
}

function Stat({ label, value, tone }: { label: string; value: bigint; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={`font-semibold tabular-nums ${tone ?? ""}`}>{formatRupiah(value)}</div>
    </div>
  );
}

async function Sheet({ periodKey }: { periodKey: string }) {
  const ctx = await requireCtx();
  const [sheet, tabs] = await Promise.all([
    getSheet(ctx, { periodKey }),
    getYearTabs(ctx, { year: parsePeriodKey(periodKey).y }),
  ]);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{formatPeriodLabel(periodKey)}</h1>
          <p className="text-xs text-muted-foreground">{formatPeriodRange(sheet.period)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Saldo awal" value={sheet.openingBalance} />
          <Stat label="Pemasukan" value={sheet.totals.income} tone="text-teal-700 dark:text-teal-400" />
          <Stat label="Pengeluaran" value={sheet.totals.expense} tone="text-orange-600 dark:text-orange-400" />
          <Stat label="Saldo akhir" value={sheet.closingBalance} tone={sheet.closingBalance < 0n ? "text-rose-600" : ""} />
        </div>
      </div>
      <SheetGrid
        periodKey={periodKey}
        periodStart={sheet.period.start}
        periodEnd={sheet.period.end}
        openingBalance={sheet.openingBalance}
        rows={sheet.rows}
        categories={sheet.categories}
        today={todayInJakarta()}
      />
      <WorkbookTabs kind="month" periodKey={periodKey} counts={Object.fromEntries(tabs.map((t) => [t.periodKey, t.count]))} />
    </>
  );
}

async function Content({ params }: { params: Promise<{ periode: string }> }) {
  const { periode } = await params;
  if (!isPeriodKey(periode)) notFound();
  return <Sheet periodKey={periode} />;
}

export default function BukuPage(props: PageProps<"/buku/[periode]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[70dvh] w-full" />}>
      <Content params={props.params} />
    </Suspense>
  );
}
