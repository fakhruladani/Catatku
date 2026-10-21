import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WorkbookTabs } from "@/components/shared/workbook-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetTable } from "@/features/budgets/components/budget-table";
import { getBudgetSheet } from "@/features/budgets/service";
import { formatPeriodLabel, isPeriodKey } from "@/lib/period";
import { requireCtx } from "@/server/auth/session";

export const metadata: Metadata = { title: "Anggaran" };

async function Content({ params }: { params: Promise<{ periode: string }> }) {
  const { periode } = await params;
  if (!isPeriodKey(periode)) notFound();
  const ctx = await requireCtx();
  const sheet = await getBudgetSheet(ctx, { periodKey: periode });
  const warn = sheet.lines.filter((l) => l.budget > 0n && l.level !== "ok");
  return (
    <div className="grid gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Anggaran {formatPeriodLabel(periode)}</h1>
        <p className="text-xs text-muted-foreground">
          Isi kolom Anggaran lalu Enter. Nominal berlaku untuk bulan ini dan bulan-bulan berikutnya sampai diubah; kosongkan untuk
          menghapus. Anggaran kategori induk mencakup subkategorinya.
        </p>
      </div>
      {warn.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" role="status">
          ⚠ {warn.map((w) => `${w.name} ${w.pct.toLocaleString("id-ID")}%`).join(" · ")}
        </div>
      )}
      <BudgetTable sheet={sheet} />
      <WorkbookTabs kind="anggaran" periodKey={periode} />
    </div>
  );
}

export default function AnggaranPage(props: PageProps<"/anggaran/[periode]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[70dvh] w-full" />}>
      <Content params={props.params} />
    </Suspense>
  );
}
