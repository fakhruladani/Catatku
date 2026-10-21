/**
 * Logika buku kas (fungsi murni, di-unit-test).
 * Nominal selalu positif; arah ditentukan `type`.
 */

export type EntryType = "INCOME" | "EXPENSE";

export interface CashRow {
  type: EntryType;
  amount: bigint;
}

export const signed = (r: CashRow): bigint => (r.type === "INCOME" ? r.amount : -r.amount);

export interface Totals {
  income: bigint;
  expense: bigint;
  net: bigint;
}

export function totalsOf(rows: Iterable<CashRow>): Totals {
  let income = 0n;
  let expense = 0n;
  for (const r of rows) {
    if (r.type === "INCOME") income += r.amount;
    else expense += r.amount;
  }
  return { income, expense, net: income - expense };
}

/** Saldo setelah setiap baris (urutan baris = urutan tampil). */
export function runningBalances(opening: bigint, rows: readonly CashRow[]): bigint[] {
  const out: bigint[] = [];
  let bal = opening;
  for (const r of rows) {
    bal += signed(r);
    out.push(bal);
  }
  return out;
}

/**
 * Saving rate = (pemasukan − pengeluaran) / pemasukan (aturan #7).
 * Mengembalikan null jika pemasukan 0 (tidak terdefinisi). Hasil dalam persen, 1 desimal.
 */
export function savingRate(income: bigint, expense: bigint): number | null {
  if (income <= 0n) return null;
  const permille = ((income - expense) * 1000n) / income; // dibulatkan ke 0 (truncation)
  return Number(permille) / 10;
}

/** Persentase perubahan cur terhadap prev (1 desimal). null jika prev 0. */
export function pctChange(cur: bigint, prev: bigint): number | null {
  if (prev === 0n) return null;
  return Number(((cur - prev) * 1000n) / (prev < 0n ? -prev : prev)) / 10;
}

/** Porsi part terhadap whole dalam persen (1 desimal), 0 jika whole 0. */
export function pctOf(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Number((part * 1000n) / whole) / 10;
}

/** Urutan baris buku kas: tanggal naik, lalu urutan input. */
export function compareRows(a: { date: string; seq: number }, b: { date: string; seq: number }): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.seq - b.seq;
}
