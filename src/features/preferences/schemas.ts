import { z } from "zod";
import { MAX_START_DAY, MIN_START_DAY } from "@/lib/period";
import { zMoney } from "@/lib/validation";

export const THEMES = ["LIGHT", "DARK", "SYSTEM"] as const;

export const zStartDay = z.coerce
  .number({ error: "Tanggal tidak valid" })
  .int("Tanggal tidak valid")
  .min(MIN_START_DAY, "Tanggal awal bulan 1–28")
  .max(MAX_START_DAY, "Tanggal awal bulan 1–28");

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(THEMES),
    financialMonthStartDay: zStartDay,
    /** Saldo kas sebelum transaksi pertama; boleh negatif */
    openingBalance: zMoney,
  })
  .partial();

export type UpdatePreferencesInput = z.output<typeof updatePreferencesSchema>;
