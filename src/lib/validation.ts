import { z } from "zod";
import { MAX_AMOUNT, parseRupiahInput } from "./money";
import { isPlainDate } from "./period";

/** ID entitas (cuid). Hanya format — kepemilikan dicek di server lewat client ter-scope. */
export const zId = z.string().trim().min(1, "ID wajib").max(64);

/** Nominal uang dari input form: string ("1.250.000") / number / bigint -> bigint */
function moneyPreprocess(v: unknown): unknown {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return Number.isSafeInteger(v) ? BigInt(v) : v;
  if (typeof v === "string") return parseRupiahInput(v) ?? v;
  return v;
}

export const zMoney = z.preprocess(
  moneyPreprocess,
  z
    .bigint({ error: "Nominal harus angka rupiah utuh" })
    .refine((n) => n <= MAX_AMOUNT && n >= -MAX_AMOUNT, "Nominal terlalu besar"),
);
export const zMoneyPositive = zMoney.refine((n) => n > 0n, "Nominal harus lebih dari 0");
export const zMoneyNonNegative = zMoney.refine((n) => n >= 0n, "Nominal tidak boleh negatif");

export const zPlainDate = z.string().refine(isPlainDate, "Tanggal tidak valid");

export const zColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna tidak valid");
export const zIcon = z.string().regex(/^[a-z0-9-]{1,40}$/, "Ikon tidak valid");
export const zName = (label = "Nama", max = 60) =>
  z.string().trim().min(1, `${label} wajib diisi`).max(max, `${label} maksimal ${max} karakter`);

export const zEmail = z.email("Email tidak valid").trim().toLowerCase().max(254);
export const zPassword = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(128, "Password maksimal 128 karakter");
