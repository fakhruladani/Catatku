"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/shared/field";
import { MoneyInput } from "@/components/shared/money-input";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentPeriodKey, formatPeriodRange, getPeriodRange } from "@/lib/period";
import { updatePreferencesAction } from "../actions";

const THEME_LABELS = { SYSTEM: "Ikuti sistem", LIGHT: "Terang", DARK: "Gelap" } as const;
type Theme = keyof typeof THEME_LABELS;

export function PreferencesForm({
  prefs,
}: {
  prefs: { theme: Theme; financialMonthStartDay: number; openingBalance: bigint };
}) {
  const [theme, setTheme] = useState<Theme>(prefs.theme);
  const [day, setDay] = useState(prefs.financialMonthStartDay);
  const [opening, setOpening] = useState(prefs.openingBalance === 0n ? "" : prefs.openingBalance.toString());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updatePreferencesAction({
        theme,
        financialMonthStartDay: day,
        openingBalance: opening === "" || opening === "-" ? "0" : opening,
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      toast.success("Pengaturan disimpan");
    });
  }

  const sample = getPeriodRange(currentPeriodKey(day), day);

  return (
    <div className="grid gap-4">
      <FormError message={error} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buku kas</CardTitle>
          <CardDescription>Menentukan saldo berjalan dan pembagian tab bulan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            label="Saldo awal"
            htmlFor="opening"
            hint="Uang yang kamu pegang sebelum transaksi pertama dicatat. Boleh minus."
          >
            <MoneyInput id="opening" allowNegative value={opening} onChange={setOpening} />
          </Field>
          <Field label="Tanggal awal bulan" htmlFor="start" hint={`Contoh periode saat ini: ${formatPeriodRange(sample)}`}>
            <NativeSelect id="start" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Tanggal {d}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tampilan</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Tema" htmlFor="theme">
            <NativeSelect id="theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
                <option key={t} value={t}>
                  {THEME_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
