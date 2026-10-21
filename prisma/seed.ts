/**
 * Seed data demo: 2 user berbeda, masing-masing ±6 bulan buku kas + anggaran.
 * Dipakai untuk mencoba aplikasi dan menguji isolasi data secara manual.
 *
 * Jalankan: npm run db:seed   (idempoten: user demo lama dihapus dulu, beserta seluruh datanya)
 * Login   : username budi / sari — password: Demo12345!
 * Akun admin TIDAK dibuat di sini — pakai `npm run admin:create`.
 */
import type { Prisma } from "../src/generated/prisma/client";
import { createAccount } from "../src/server/admin/accounts";
import { basePrisma } from "../src/server/db/base-client";
import { forUser, type ScopedDb } from "../src/server/db/scoped";
import { currentPeriodKey, shiftPeriod, todayInJakarta, toDbDate } from "../src/lib/period";

const PASSWORD = "Demo12345!";

// PRNG deterministik agar seed selalu sama
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
const dayOf = (d: string) => Number(d.slice(8, 10));
/** Dibulatkan ke ribuan — nominal realistis */
const rb = (n: number) => BigInt(Math.round(n / 1000) * 1000);

type Cat = Map<string, string>; // "EXPENSE:Makan di luar" -> id

async function createDemoUser(name: string, username: string, nickname: string, startDay: number, opening: bigint) {
  const existing = await basePrisma.user.findUnique({ where: { username } });
  if (existing) await basePrisma.user.delete({ where: { id: existing.id } }); // cascade
  const { id } = await createAccount({ username, name, password: PASSWORD });
  const user = await basePrisma.user.update({
    where: { id },
    data: { nickname, onboardingCompletedAt: new Date() },
  });
  const db = forUser(user.id);
  await db.userPreference.update({
    where: { userId: user.id },
    data: { financialMonthStartDay: startDay, openingBalance: opening },
  });
  return { userId: user.id, db };
}

async function categoryMap(db: ScopedDb): Promise<Cat> {
  const rows = await db.category.findMany({ select: { id: true, name: true, type: true } });
  return new Map(rows.map((r) => [`${r.type}:${r.name}`, r.id]));
}

function cat(c: Cat, key: string): string {
  const id = c.get(key);
  if (!id) throw new Error(`Kategori tidak ada: ${key}`);
  return id;
}

type Row = Omit<Prisma.TransactionUncheckedCreateInput, "userId" | "date"> & { date: string };

async function insert(db: ScopedDb, userId: string, rows: Row[]) {
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  await db.transaction.createMany({ data: rows.map((r) => ({ ...r, userId, date: toDbDate(r.date) })) });
  return rows.length;
}

async function budgets(db: ScopedDb, userId: string, c: Cat, startDay: number, list: [string, number][]) {
  const from = shiftPeriod(currentPeriodKey(startDay), -5);
  await db.budget.createMany({
    data: list.map(([name, amount]) => ({ userId, categoryId: cat(c, `EXPENSE:${name}`), amount: BigInt(amount), effectiveFrom: from })),
  });
}

async function seedBudi() {
  const { userId, db } = await createDemoUser("Budi Santoso", "budi", "Budi", 25, 3_500_000n);
  const c = await categoryMap(db);
  const rnd = mulberry32(42);
  const today = todayInJakarta();
  const rows: Row[] = [];
  const E = (date: string, amount: bigint, category: string, description: string) =>
    rows.push({ date, type: "EXPENSE", amount, categoryId: cat(c, `EXPENSE:${category}`), description });
  const I = (date: string, amount: bigint, category: string, description: string) =>
    rows.push({ date, type: "INCOME", amount, categoryId: cat(c, `INCOME:${category}`), description });

  for (let d = addDays(today, -183); d <= today; d = addDays(d, 1)) {
    const day = dayOf(d);
    if (day === 25) I(d, 12_000_000n, "Gaji", "Gaji bulanan");
    if (day === 26) E(d, 2_500_000n, "Sewa / kos", "Bayar kos");
    if (day === 27) E(d, rb(380_000 + rnd() * 120_000), "Listrik", "Token listrik");
    if (day === 28) E(d, 350_000n, "Internet & pulsa", "Internet rumah");
    if (day === 10) E(d, 54_990n, "Langganan digital", "Streaming film");
    if (day === 1) E(d, 1_000_000n, "Keluarga", "Kirim ke orang tua");
    E(d, rb(25_000 + rnd() * 35_000), "Makan di luar", rnd() < 0.5 ? "Makan siang kantor" : "Makan siang");
    if (rnd() < 0.5) E(d, rb(15_000 + rnd() * 25_000), "Ojek online", "Ojol ke kantor");
    if (rnd() < 0.3) E(d, rb(18_000 + rnd() * 30_000), "Kopi & jajan", "Kopi");
    if (rnd() < 0.12) E(d, rb(150_000 + rnd() * 350_000), "Belanja dapur", "Belanja mingguan");
    if (rnd() < 0.05) E(d, rb(100_000 + rnd() * 600_000), "Rekreasi", "Jalan-jalan akhir pekan");
    if (rnd() < 0.04) I(d, rb(500_000 + rnd() * 1_500_000), "Usaha / Freelance", "Proyek desain");
    if (rnd() < 0.02) E(d, rb(20_000 + rnd() * 80_000), "Parkir & tol", "");
  }
  const n = await insert(db, userId, rows);
  await budgets(db, userId, c, 25, [
    ["Makan & Minum", 2_500_000],
    ["Transportasi", 800_000],
    ["Hiburan", 500_000],
    ["Tagihan", 900_000],
  ]);
  return n;
}

async function seedSari() {
  const { userId, db } = await createDemoUser("Sari Wulandari", "sari", "Sari", 1, 1_200_000n);
  const c = await categoryMap(db);
  const rnd = mulberry32(7);
  const today = todayInJakarta();
  const rows: Row[] = [];
  const E = (date: string, amount: bigint, category: string, description: string) =>
    rows.push({ date, type: "EXPENSE", amount, categoryId: cat(c, `EXPENSE:${category}`), description });
  const I = (date: string, amount: bigint, category: string, description: string) =>
    rows.push({ date, type: "INCOME", amount, categoryId: cat(c, `INCOME:${category}`), description });

  for (let d = addDays(today, -183); d <= today; d = addDays(d, 1)) {
    const day = dayOf(d);
    if (day === 1) {
      I(d, 8_500_000n, "Gaji", "Gaji");
      E(d, 1_200_000n, "Keluarga", "Kirim ke orang tua");
    }
    if (day === 5) E(d, rb(200_000 + rnd() * 80_000), "Listrik", "Listrik");
    if (day === 7) E(d, 1_800_000n, "Sewa / kos", "Sewa kamar");
    if (day === 12) E(d, 150_000n, "Zakat & sedekah", "Sedekah rutin");
    if (day === 15) I(d, rb(80_000 + rnd() * 40_000), "Hasil investasi", "Kupon ORI");
    E(d, rb(20_000 + rnd() * 30_000), "Makan di luar", "Makan");
    if (rnd() < 0.35) E(d, rb(10_000 + rnd() * 15_000), "Transportasi umum", "KRL / TransJakarta");
    if (rnd() < 0.1) E(d, rb(100_000 + rnd() * 400_000), "Belanja dapur", "Belanja pasar");
    if (rnd() < 0.06) E(d, rb(150_000 + rnd() * 500_000), "Pakaian", "Baju");
    if (rnd() < 0.03) E(d, rb(100_000 + rnd() * 300_000), "Kesehatan", "Obat & dokter");
    if (rnd() < 0.05) I(d, rb(300_000 + rnd() * 1_200_000), "Usaha / Freelance", "Les privat");
  }
  // beberapa baris tanpa kategori — seperti catatan cepat di spreadsheet
  rows.push({ date: addDays(today, -3), type: "EXPENSE", amount: 75_000n, categoryId: null, description: "Patungan kado" });
  const n = await insert(db, userId, rows);
  await budgets(db, userId, c, 1, [
    ["Makan & Minum", 1_800_000],
    ["Belanja", 600_000],
    ["Transportasi", 400_000],
  ]);
  return n;
}

async function main() {
  const budi = await seedBudi();
  const sari = await seedSari();
  console.info(`Seed selesai:
  budi  (${budi} transaksi, tanggal awal bulan 25)
  sari  (${sari} transaksi, tanggal awal bulan 1)
  Password keduanya: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
