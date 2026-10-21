import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { parsePeriodKey, periodKey as makeKey, shiftPeriod } from "@/lib/period";

export type TabKind = "month" | "rekap" | "tahunan" | "anggaran" | "kategori";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * Tab bawah ala workbook Excel: 12 sheet bulan + sheet rekap/anggaran/kategori.
 * `periodKey` = konteks bulan aktif (dibawa saat pindah tab).
 */
export function WorkbookTabs({
  kind,
  periodKey,
  counts,
}: {
  kind: TabKind;
  periodKey: string;
  counts?: Record<string, number>;
}) {
  const { y } = parsePeriodKey(periodKey);
  const hrefForYear = (delta: number) => {
    const k = shiftPeriod(periodKey, delta * 12);
    if (kind === "month") return `/buku/${k}`;
    if (kind === "rekap") return `/rekap/${k}`;
    if (kind === "tahunan") return `/rekap-tahunan/${y + delta}`;
    if (kind === "anggaran") return `/anggaran/${k}`;
    return `/kategori?p=${k}`;
  };

  const tab = (href: string, label: React.ReactNode, active: boolean, key: string, accent = false) => (
    <Link
      key={key}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative -mt-px flex h-9 shrink-0 items-center gap-1.5 border-x border-transparent px-3 text-sm whitespace-nowrap transition-colors ${
        active
          ? "border-border bg-background font-semibold text-foreground shadow-[inset_0_2px_0_var(--primary)]"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
      } ${accent ? "font-medium" : ""}`}
    >
      {label}
    </Link>
  );

  return (
    <nav
      aria-label="Sheet"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-muted/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="flex shrink-0 items-center border-r px-1">
        <Link href={hrefForYear(-1)} aria-label="Tahun sebelumnya" className="rounded p-1.5 text-muted-foreground hover:bg-background">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="px-1 text-sm font-semibold tabular-nums">{y}</span>
        <Link href={hrefForYear(1)} aria-label="Tahun berikutnya" className="rounded p-1.5 text-muted-foreground hover:bg-background">
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:thin]">
        {MONTHS.map((m, i) => {
          const k = makeKey(y, i + 1);
          const n = counts?.[k] ?? 0;
          return tab(
            `/buku/${k}`,
            <>
              {m}
              {n > 0 && <span className="size-1.5 rounded-full bg-primary/60" aria-label={`${n} transaksi`} />}
            </>,
            kind === "month" && periodKey === k,
            k,
          );
        })}
        <span className="mx-1 my-2 w-px shrink-0 bg-border" aria-hidden />
        {tab(`/rekap/${periodKey}`, "Rekap Bulanan", kind === "rekap", "rekap", true)}
        {tab(`/rekap-tahunan/${y}`, "Rekap Tahunan", kind === "tahunan", "tahunan", true)}
        {tab(`/anggaran/${periodKey}`, "Anggaran", kind === "anggaran", "anggaran", true)}
        {tab(`/kategori?p=${periodKey}`, "Kategori", kind === "kategori", "kategori", true)}
      </div>
    </nav>
  );
}
