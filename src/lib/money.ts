/**
 * Uang di Catatku selalu rupiah utuh bertipe bigint (aturan bisnis #1).
 * Di batas server -> client, bigint dikirim sebagai string ("1250000").
 */

export type MoneyLike = bigint | string | number;

export const MAX_AMOUNT = 999_999_999_999_999n; // ~ 1 kuadriliun

export function toBigInt(v: MoneyLike): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new Error("Nominal harus bilangan bulat");
    return BigInt(v);
  }
  if (!/^-?\d+$/.test(v)) throw new Error(`Nominal tidak valid: ${v}`);
  return BigInt(v);
}

/** 1250000n -> "Rp1.250.000"; -5000n -> "-Rp5.000" */
export function formatRupiah(v: MoneyLike): string {
  const n = toBigInt(v);
  const neg = n < 0n;
  const digits = (neg ? -n : n).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}Rp${grouped}`;
}

/** Format angka tanpa "Rp" untuk input: 1250000 -> "1.250.000" */
export function formatThousands(v: MoneyLike): string {
  return formatRupiah(v).replace("Rp", "");
}

/**
 * Parse input pengguna: "Rp1.250.000", "1.250.000", "1250000" -> 1250000n.
 * Desimal (koma) ditolak karena nominal uang harus rupiah utuh.
 * Mengembalikan null bila tidak valid.
 */
export function parseRupiahInput(raw: string): bigint | null {
  const s = raw.trim().replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
  if (s === "") return null;
  let neg = false;
  let body = s;
  if (body.startsWith("-")) {
    neg = true;
    body = body.slice(1);
  }
  if (body.includes(",")) return null;
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(body)) return null;
  const n = BigInt(body.replace(/\./g, ""));
  if (n > MAX_AMOUNT) return null;
  return neg ? -n : n;
}

export function sumBigInt(values: Iterable<bigint>): bigint {
  let total = 0n;
  for (const v of values) total += v;
  return total;
}
