/**
 * Periode bulan keuangan (aturan bisnis #10).
 *
 * - Tanggal direpresentasikan sebagai string "YYYY-MM-DD" (tanggal lokal Asia/Jakarta).
 * - periodKey "YYYY-MM" = periode yang BERAKHIR di bulan tersebut.
 *   startDay = 25 -> "2026-10" = 2026-09-25 s.d. 2026-10-24.
 *   startDay = 1  -> "2026-10" = 2026-10-01 s.d. 2026-10-31.
 * - startDay dibatasi 1..28 sehingga selalu valid di setiap bulan.
 */

export const APP_TIMEZONE = "Asia/Jakarta";
export const MIN_START_DAY = 1;
export const MAX_START_DAY = 28;

export type PlainDate = string; // "YYYY-MM-DD"
export type PeriodKey = string; // "YYYY-MM"

export interface PeriodRange {
  key: PeriodKey;
  start: PlainDate;
  end: PlainDate; // inklusif
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function assertStartDay(startDay: number): void {
  if (!Number.isInteger(startDay) || startDay < MIN_START_DAY || startDay > MAX_START_DAY) {
    throw new RangeError(`Tanggal awal bulan harus 1–28, diterima: ${startDay}`);
  }
}

export function parsePlainDate(d: PlainDate): { y: number; m: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!match) throw new RangeError(`Tanggal tidak valid: ${d}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const day = Number(match[3]);
  if (m < 1 || m > 12 || day < 1 || day > daysInMonth(y, m)) {
    throw new RangeError(`Tanggal tidak valid: ${d}`);
  }
  return { y, m, day };
}

export function isPlainDate(d: string): boolean {
  try {
    parsePlainDate(d);
    return true;
  } catch {
    return false;
  }
}

export function plainDate(y: number, m: number, day: number): PlainDate {
  return `${pad(y, 4)}-${pad(m)}-${pad(day)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Tambah n bulan ke (y, m); m 1..12 */
function addMonths(y: number, m: number, n: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function parsePeriodKey(key: PeriodKey): { y: number; m: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new RangeError(`Periode tidak valid: ${key}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) throw new RangeError(`Periode tidak valid: ${key}`);
  return { y, m };
}

export function isPeriodKey(key: string): boolean {
  try {
    parsePeriodKey(key);
    return true;
  } catch {
    return false;
  }
}

export function periodKey(y: number, m: number): PeriodKey {
  return `${pad(y, 4)}-${pad(m)}`;
}

export function getPeriodRange(key: PeriodKey, startDay: number): PeriodRange {
  assertStartDay(startDay);
  const { y, m } = parsePeriodKey(key);
  if (startDay === 1) {
    return { key, start: plainDate(y, m, 1), end: plainDate(y, m, daysInMonth(y, m)) };
  }
  const prev = addMonths(y, m, -1);
  return {
    key,
    start: plainDate(prev.y, prev.m, startDay),
    end: plainDate(y, m, startDay - 1),
  };
}

export function getPeriodKeyForDate(date: PlainDate, startDay: number): PeriodKey {
  assertStartDay(startDay);
  const { y, m, day } = parsePlainDate(date);
  if (startDay === 1 || day < startDay) return periodKey(y, m);
  const next = addMonths(y, m, 1);
  return periodKey(next.y, next.m);
}

export function shiftPeriod(key: PeriodKey, n: number): PeriodKey {
  const { y, m } = parsePeriodKey(key);
  const r = addMonths(y, m, n);
  return periodKey(r.y, r.m);
}

/** Daftar n periode terakhir, berakhir di `key` (urut lama -> baru). */
export function lastNPeriods(key: PeriodKey, n: number): PeriodKey[] {
  return Array.from({ length: n }, (_, i) => shiftPeriod(key, i - (n - 1)));
}

export function comparePlainDate(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Tanggal hari ini di Asia/Jakarta. */
export function todayInJakarta(now: Date = new Date()): PlainDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA -> YYYY-MM-DD
}

export function currentPeriodKey(startDay: number, now: Date = new Date()): PeriodKey {
  return getPeriodKeyForDate(todayInJakarta(now), startDay);
}

/** PlainDate -> Date untuk kolom Prisma @db.Date (tengah malam UTC). */
export function toDbDate(d: PlainDate): Date {
  parsePlainDate(d);
  return new Date(`${d}T00:00:00.000Z`);
}

/** Date dari kolom @db.Date -> PlainDate */
export function fromDbDate(d: Date): PlainDate {
  return d.toISOString().slice(0, 10);
}

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function formatPeriodLabel(key: PeriodKey): string {
  const { y, m } = parsePeriodKey(key);
  return `${BULAN[m - 1]} ${y}`;
}

/** "2026-10-21" -> "21 Okt 2026" */
export function formatPlainDate(d: PlainDate): string {
  const { y, m, day } = parsePlainDate(d);
  return `${day} ${BULAN_SINGKAT[m - 1]} ${y}`;
}

export function formatPeriodRange(r: PeriodRange): string {
  return `${formatPlainDate(r.start)} – ${formatPlainDate(r.end)}`;
}
