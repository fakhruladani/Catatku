import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { formatRupiah } from "@/lib/money";

export function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Perubahan % vs periode lalu. `goodWhenUp` menentukan warna (pengeluaran naik = buruk). */
export function Change({ pct, goodWhenUp = true }: { pct: number | null; goodWhenUp?: boolean }) {
  if (pct === null) return <span>Bulan lalu belum ada data</span>;
  const up = pct > 0;
  const good = pct === 0 ? null : up === goodWhenUp;
  const Icon = pct === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 ${good === null ? "" : good ? "text-teal-700 dark:text-teal-400" : "text-orange-600 dark:text-orange-400"}`}>
      <Icon className="size-3" aria-hidden />
      {Math.abs(pct).toLocaleString("id-ID")}% vs bulan lalu
    </span>
  );
}

export const rp = (v: bigint) => formatRupiah(v);
export const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("id-ID")}%`);

/** Batang horizontal sederhana di dalam tabel (porsi 0–100). */
export function InlineBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
    </div>
  );
}

export function BudgetBadge({ level, pct: p }: { level: "ok" | "warning" | "over"; pct: number }) {
  const map = {
    ok: ["bg-teal-500/10 text-teal-700 dark:text-teal-400", "Aman"],
    warning: ["bg-amber-500/15 text-amber-700 dark:text-amber-300", "≥80%"],
    over: ["bg-rose-500/15 text-rose-700 dark:text-rose-300", "Lewat"],
  } as const;
  const [cls, label] = map[level];
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap tabular-nums ${cls}`}>
      {label} · {p.toLocaleString("id-ID")}%
    </span>
  );
}

