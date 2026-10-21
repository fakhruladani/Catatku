"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { IconBadge } from "@/components/shared/icon";
import { Input } from "@/components/ui/input";
import { BudgetBadge, InlineBar } from "@/features/recap/components/ui";
import { formatRupiah, formatThousands, parseRupiahInput } from "@/lib/money";
import { setBudgetAction } from "../actions";
import type { BudgetSheetDto } from "../service";

const BAR_COLOR = { ok: "#0d9488", warning: "#d97706", over: "#e11d48" } as const;

function BudgetCell({ categoryId, periodKey, amount, inherited }: { categoryId: string; periodKey: string; amount: bigint; inherited: boolean }) {
  const initial = amount > 0n ? formatThousands(amount) : "";
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();

  const save = () => {
    const v = value.trim() === "" ? 0n : parseRupiahInput(value);
    if (v === null || v < 0n) {
      toast.error("Nominal anggaran tidak valid");
      setValue(initial);
      return;
    }
    if (v === amount) return;
    start(async () => {
      const res = await setBudgetAction({ categoryId, periodKey, amount: v.toString() });
      if (!res.ok) {
        toast.error(res.error);
        setValue(initial);
      } else toast.success(v === 0n ? "Anggaran dihapus mulai bulan ini" : "Anggaran disimpan (berlaku juga untuk bulan berikutnya)");
    });
  };

  return (
    <Input
      inputMode="numeric"
      aria-label="Nominal anggaran"
      className={`h-7 text-right tabular-nums ${inherited ? "text-muted-foreground" : ""}`}
      placeholder="—"
      value={value}
      disabled={pending}
      title={inherited ? "Diteruskan dari bulan sebelumnya" : undefined}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
        setValue(digits ? formatThousands(digits) : "");
      }}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(initial);
      }}
    />
  );
}

export function BudgetTable({ sheet }: { sheet: BudgetSheetDto }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Kategori pengeluaran</th>
            <th className="w-40 px-3 py-2 text-right font-medium">Anggaran</th>
            <th className="w-32 px-3 py-2 text-right font-medium">Realisasi</th>
            <th className="w-32 px-3 py-2 text-right font-medium">Sisa</th>
            <th className="w-56 px-3 py-2 text-left font-medium">Progres</th>
          </tr>
        </thead>
        <tbody>
          {sheet.lines.map((l) => (
            <tr key={l.categoryId} className={`border-t border-border/60 ${l.parentId ? "text-muted-foreground" : ""}`}>
              <td className={`px-3 py-1.5 ${l.parentId ? "pl-10 text-xs" : ""}`}>
                <span className="inline-flex items-center gap-2">
                  {!l.parentId && <IconBadge icon={l.icon} color={l.color} className="size-6" />}
                  {l.name}
                </span>
              </td>
              <td className="px-3 py-1">
                <BudgetCell key={`${l.categoryId}:${l.budget}`} categoryId={l.categoryId} periodKey={sheet.periodKey} amount={l.budget} inherited={l.inherited} />
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatThousands(l.spent)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${l.budget > 0n && l.remaining < 0n ? "text-rose-600" : ""}`}>
                {l.budget > 0n ? formatThousands(l.remaining) : "–"}
              </td>
              <td className="px-3 py-1.5">
                {l.budget > 0n ? (
                  <div className="flex items-center gap-2">
                    <InlineBar value={l.pct} color={BAR_COLOR[l.level]} />
                    <BudgetBadge level={l.level} pct={l.pct} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/60">Tanpa anggaran</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/50 font-medium">
          <tr>
            <td className="px-3 py-2">Total dianggarkan</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(sheet.total.budget)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(sheet.total.spent)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${sheet.total.remaining < 0n ? "text-rose-600" : ""}`}>
              {formatRupiah(sheet.total.remaining)}
            </td>
            <td className="px-3 py-2">{sheet.total.budget > 0n && <BudgetBadge level={sheet.total.level} pct={sheet.total.pct} />}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
