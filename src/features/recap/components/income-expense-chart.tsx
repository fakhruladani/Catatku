"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRupiah } from "@/lib/money";

// Pasangan tervalidasi (CVD-safe, terang & gelap): Masuk = teal, Keluar = oranye
export const INCOME_COLOR = "#0d9488";
export const EXPENSE_COLOR = "#ea580c";

function short(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}jt`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return String(n);
}

/** Grafik batang pemasukan vs pengeluaran per bulan. Nilai dikirim sebagai string (bigint) lalu diubah ke number hanya untuk skala. */
export function IncomeExpenseChart({ data }: { data: { label: string; income: string; expense: string }[] }) {
  const rows = data.map((d) => ({ label: d.label, Masuk: Number(d.income), Keluar: Number(d.expense) }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Grafik pemasukan dan pengeluaran per bulan">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            tickFormatter={short}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            formatter={(v) => formatRupiah(BigInt(Math.round(Number(v))))}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          <Bar dataKey="Masuk" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          <Bar dataKey="Keluar" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
