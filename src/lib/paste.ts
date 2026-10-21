/**
 * Parser data yang di-paste dari Excel / Google Sheets (TSV) ke sheet Catatku.
 * Kolom sheet yang bisa diisi (urutan tampil): Tanggal, Keterangan, Jenis, Kategori, Nominal.
 */
import { MAX_AMOUNT } from "./money";
import { isPlainDate, plainDate } from "./period";
import type { EntryType } from "./finance/cashbook";

export const EDITABLE_COLUMNS = ["date", "description", "type", "category", "amount"] as const;
export type EditableColumn = (typeof EDITABLE_COLUMNS)[number];

export interface PastedRow {
  date?: string;
  description?: string;
  type?: EntryType;
  categoryName?: string;
  amount?: bigint;
  /** Kolom yang ada isinya tapi tidak bisa dibaca */
  invalid: EditableColumn[];
}

/** Pecah teks clipboard menjadi grid sel. Mendukung sel ber-kutip (Excel) berisi tab/baris baru. */
export function splitTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let quoted = false;
  const t = text.replace(/\r\n?/g, "\n");
  while (i < t.length) {
    const ch = t[i]!;
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        quoted = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
      i++;
      continue;
    }
    if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
    i++;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const BULAN: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3,
  apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12,
};

/**
 * Tanggal longgar: "2026-10-21", "21/10/2026", "21-10-26", "21 Okt 2026", "21 Oktober 2026",
 * serial Excel (mis. 46316). Format d/m/y (Indonesia), bukan m/d/y.
 * `defaultYear` dipakai jika tahun tidak ditulis ("21/10").
 */
export function parseDateLoose(raw: string, defaultYear: number): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (isPlainDate(s)) return s;
  let m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : defaultYear;
    const d = plainDate(y, Number(m[2]), Number(m[1]));
    return isPlainDate(d) ? d : null;
  }
  m = /^(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{2,4}))?$/.exec(s);
  if (m && BULAN[m[2]!]) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : defaultYear;
    const d = plainDate(y, BULAN[m[2]!]!, Number(m[1]));
    return isPlainDate(d) ? d : null;
  }
  if (/^\d{5}$/.test(s)) {
    // serial tanggal Excel (epoch 1899-12-30)
    const ms = Date.UTC(1899, 11, 30) + Number(s) * 86_400_000;
    const d = new Date(ms).toISOString().slice(0, 10);
    return isPlainDate(d) ? d : null;
  }
  return null;
}

/**
 * Nominal longgar: "Rp1.250.000", "1.250.000", "1,250,000", "1250000", "-50.000", "(50.000)", "1.250.000,00".
 * Desimal non-nol ditolak (rupiah utuh). Mengembalikan nilai bertanda (negatif = keluar).
 */
export function parseAmountLoose(raw: string): bigint | null {
  let s = raw.trim().replace(/\s/g, "").replace(/^rp\.?/i, "").replace(/^idr/i, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/^rp\.?/i, "");
  // desimal ,00 atau .00 di akhir (2 digit) — hanya boleh nol
  const dec = /^(.*?)[.,](\d{1,2})$/.exec(s);
  if (dec && !/^\d{1,3}([.,]\d{3})+$/.test(s)) {
    if (Number(dec[2]) !== 0) return null;
    s = dec[1]!;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = BigInt(s);
  if (n === 0n || n > MAX_AMOUNT) return null;
  return neg ? -n : n;
}

export function parseTypeLoose(raw: string): EntryType | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (["masuk", "pemasukan", "income", "in", "m", "+", "debit", "kredit masuk", "penerimaan"].includes(s)) return "INCOME";
  if (["keluar", "pengeluaran", "expense", "out", "k", "-", "biaya", "pembayaran"].includes(s)) return "EXPENSE";
  if (s.startsWith("pemasukan") || s.startsWith("masuk")) return "INCOME";
  if (s.startsWith("pengeluaran") || s.startsWith("keluar")) return "EXPENSE";
  return null;
}

const HEADER_WORDS = ["tanggal", "tgl", "date", "keterangan", "deskripsi", "jenis", "tipe", "kategori", "nominal", "jumlah", "amount"];

/** Baris header (mis. "Tanggal  Keterangan  ...") di-skip. */
export function isHeaderRow(cells: string[]): boolean {
  const hits = cells.filter((c) => HEADER_WORDS.includes(c.trim().toLowerCase())).length;
  return hits >= 2;
}

/**
 * Ubah grid hasil paste menjadi baris Catatku, dipetakan mulai dari kolom `startColumn`.
 * Jika Jenis kosong tetapi Nominal bertanda negatif -> Keluar, positif -> `fallbackType`.
 */
export function mapPastedGrid(
  grid: string[][],
  startColumn: EditableColumn,
  opts: { defaultYear: number; fallbackType: EntryType },
): PastedRow[] {
  const startIdx = EDITABLE_COLUMNS.indexOf(startColumn);
  const body = grid.length > 0 && isHeaderRow(grid[0]!) ? grid.slice(1) : grid;
  return body.map((cells) => {
    const row: PastedRow = { invalid: [] };
    let signedAmount: bigint | null = null;
    cells.forEach((value, j) => {
      const col = EDITABLE_COLUMNS[startIdx + j];
      if (!col) return;
      const v = value.trim();
      if (v === "") return;
      switch (col) {
        case "date": {
          const d = parseDateLoose(v, opts.defaultYear);
          if (d) row.date = d;
          else row.invalid.push("date");
          break;
        }
        case "description":
          row.description = v.slice(0, 200);
          break;
        case "type": {
          const t = parseTypeLoose(v);
          if (t) row.type = t;
          else row.invalid.push("type");
          break;
        }
        case "category":
          row.categoryName = v;
          break;
        case "amount": {
          const a = parseAmountLoose(v);
          if (a === null) row.invalid.push("amount");
          else signedAmount = a;
          break;
        }
      }
    });
    if (signedAmount !== null) {
      const a: bigint = signedAmount;
      row.amount = a < 0n ? -a : a;
      if (!row.type) row.type = a < 0n ? "EXPENSE" : undefined;
    }
    if (!row.type && row.amount !== undefined) row.type = opts.fallbackType;
    return row;
  });
}

/** Cari kategori berdasarkan nama (case-insensitive), sesuai jenis. "Induk > Anak" juga didukung. */
export function matchCategory(
  name: string | undefined,
  type: EntryType,
  cats: readonly { id: string; name: string; type: EntryType; parentName: string | null }[],
): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const sameType = cats.filter((c) => c.type === type);
  const full = sameType.find((c) => (c.parentName ? `${c.parentName} > ${c.name}` : c.name).toLowerCase() === n);
  if (full) return full.id;
  const exact = sameType.filter((c) => c.name.toLowerCase() === n);
  if (exact.length >= 1) return (exact.find((c) => c.parentName) ?? exact[0])!.id;
  return null;
}

/**
 * Input nominal saat mengetik di sel: semua format parseAmountLoose + singkatan
 * "35rb" / "35k" = 35.000, "1,5jt" / "1.5jt" = 1.500.000.
 */
export function parseAmountInput(raw: string): bigint | null {
  const s = raw.trim().toLowerCase().replace(/\s/g, "");
  const m = /^(-?)(\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta)$/.exec(s);
  if (m) {
    const [intPart, fracPart = ""] = m[2]!.split(/[.,]/);
    const mult = m[3] === "jt" || m[3] === "juta" ? 1_000_000n : 1_000n;
    const fracDigits = fracPart.length;
    const scaled = BigInt(intPart! + fracPart) * mult;
    const div = 10n ** BigInt(fracDigits);
    if (scaled % div !== 0n) return null;
    const n = scaled / div;
    if (n === 0n || n > MAX_AMOUNT) return null;
    return m[1] ? -n : n;
  }
  return parseAmountLoose(raw);
}
