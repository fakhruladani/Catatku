# Catatku — Dokumen Desain Teknis

Terakhir diperbarui: 21 Okt 2026 (versi 2 — buku kas ala spreadsheet)
Sumber kebenaran skema: `prisma/schema.prisma` + `prisma/sql/checks.sql`.

## 0. Arah produk (berubah dari versi 1)

Catatku adalah **aplikasi manajemen kas masuk & keluar berbentuk spreadsheet**, bukan aplikasi dompet.
Versi 1 (dompet, transfer, investasi, target, utang, net worth) **dihapus** atas permintaan pemilik produk.

| Keputusan (dari pemilik produk) | Pilihan |
|---|---|
| Kolom sheet | Tanggal · Keterangan · **Jenis (Masuk/Keluar)** · Kategori · **Nominal** · Saldo berjalan |
| Struktur | **Tab per bulan ala workbook Excel** (Jan–Des per tahun) |
| Tab tambahan | Rekap Bulanan, Rekap Tahunan, Anggaran, Kategori |
| Fitur spreadsheet | Ekspor .xlsx, paste banyak baris dari Excel/Sheets, navigasi keyboard |

Yang dipertahankan dari versi 1: multi-user + isolasi data, Better Auth (rate limit, argon2id), kategori + subkategori 1 level, tanggal awal bulan keuangan (1–28), tema, onboarding, VPS.

## 0b. Model akun (sejak 21 Okt 2026)

- Login dengan **username** + password. Tidak ada pendaftaran mandiri, verifikasi email, atau lupa password via email.
- Peran `USER` (punya buku kas) dan `ADMIN` (hanya Manajemen User, tanpa buku kas). Akun dibuat admin lewat `/admin` atau `npm run admin:create`.
- Admin: tambah user, atur ulang password (semua sesi user dicabut), hapus permanen (cascade). Admin hanya melihat metadata (username, nama, dibuat, login terakhir, jumlah baris), bukan isi catatan.
- Semua pengguna bisa mengganti password sendiri (perlu password lama; sesi lain dikeluarkan).
- Kode lintas-user hanya di `src/server/admin/**`; setiap aksi mengecek ulang peran ke database. `runAction` (buku kas) menolak akun admin.
- Kolom `User.email` tetap ada karena diwajibkan Better Auth, diisi email internal `<username>@users.catatku.invalid` (tidak dipakai).

## 1. Stack

Next.js 16.4 (App Router, Cache Components) · TypeScript · PostgreSQL 16 + Prisma 7 · Better Auth 1.7 · Tailwind v4 + shadcn/ui (Base UI) · Zod 4 · Recharts 3 · ExcelJS · Vitest 5.

## 2. Model data

| Tabel | Isi |
|---|---|
| `Transaction` | satu baris buku kas: `date` (DATE lokal WIB), `type` INCOME/EXPENSE, `amount` BIGINT > 0, `description` (≤200), `categoryId?`, `seq` (urutan input) |
| `Category` | `type` INCOME/EXPENSE, `parentId?` (1 level), ikon, warna, `archivedAt` |
| `Budget` | anggaran kategori pengeluaran, berlaku mulai `effectiveFrom` ("YYYY-MM") sampai diubah; `amount = 0` = hapus |
| `UserPreference` | `openingBalance` (saldo awal kas, boleh minus), `financialMonthStartDay` 1–28, `theme` |
| Auth | `User`, `Session`, `Account`, `Verification`, `TwoFactor`, `RateLimit` (format Better Auth) |

Perlindungan di level database:
- Composite FK `(xId, userId) → (id, userId)` → tidak bisa merujuk data user lain.
- FK transaksi→kategori **menyertakan `type`**: `(categoryId, userId, type) → Category(id, userId, type)`. Database menolak transaksi Masuk dengan kategori Pengeluaran, dan sebaliknya. Subkategori juga dipaksa bertipe sama dengan induknya.
- CHECK: nominal > 0 dan ≤ 999 triliun, tanggal awal bulan 1–28, format `effectiveFrom`, nama kategori tidak kosong.

## 3. Rumus

| Besaran | Rumus | Lokasi |
|---|---|---|
| Saldo awal periode | `openingBalance` + Σ(masuk − keluar) semua transaksi sebelum tanggal mulai periode | `transactions/service.balanceBefore` |
| Saldo berjalan | saldo awal periode + kumulatif per baris (urut tanggal, lalu urutan input) | `lib/finance/cashbook.runningBalances` |
| Saving rate | (masuk − keluar) / masuk; "—" bila masuk = 0 | `cashbook.savingRate` |
| Rekap per kategori | subkategori dijumlah ke induk; transaksi tanpa kategori = "Tanpa kategori" | `lib/finance/recap.byCategory` |
| Pivot tahunan | kategori induk × 12 periode; rata-rata = total / jumlah periode yang sudah berjalan | `recap.pivot` |
| Anggaran | realisasi induk = induk + subkategori; peringatan ≥80%, lewat ≥100% | `recap.budgetStatus`, `budgets/service` |

Periode: `periodKey` "YYYY-MM" = bulan tempat periode berakhir (awal bulan 25 → "Oktober" = 25 Sep–24 Okt).

## 4. Isolasi data per user

1. `userId` hanya dari sesi (`runAction`/`requireCtx`); skema Zod tidak punya `userId`.
2. `forUser(userId)` (Prisma extension) hanya mengekspos `UserPreference`, `Category`, `Transaction`, `Budget`; menyuntikkan `userId` ke setiap query, menolak filter `userId` asing, menolak operasi tak dikenal.
3. Composite FK (di atas).
4. ESLint melarang impor Prisma mentah di luar `src/server/db` & `src/server/auth`.
5. Test: matriks serangan untuk setiap fungsi `features/*/service.ts` (gagal jika ada service baru tanpa kasus), snapshot data korban sebelum/sesudah, cek ekspor Excel tidak memuat data user lain.

## 5. Halaman & tab

| Route | Isi |
|---|---|
| `/buku/[YYYY-MM]` | Sheet bulan: grid editable, saldo berjalan, total; tab bawah Jan–Des + rekap |
| `/rekap/[YYYY-MM]` | KPI (masuk, keluar, selisih, saving rate, saldo akhir) + Δ vs bulan lalu, tabel per kategori (dengan rincian subkategori), top 5, pemasukan per kategori, status anggaran |
| `/rekap-tahunan/[YYYY]` | KPI tahunan, grafik batang masuk vs keluar, ringkasan per bulan, pivot kategori × bulan |
| `/anggaran/[YYYY-MM]` | Tabel anggaran editable per kategori (berlaku ke depan), realisasi, sisa, progres |
| `/kategori` | Kelola kategori (tambah, ubah, subkategori, arsip) |
| `/api/ekspor/xlsx?tahun=` | Workbook: 12 sheet bulan (rumus saldo berjalan & SUMIF total) + Rekap Tahunan |
| `/pengaturan`, `/pengaturan/preferensi`, `/onboarding` | Saldo awal, tanggal awal bulan, tema |

## 6. Grid spreadsheet (`features/transactions/components/sheet-grid.tsx`)

- Ketik langsung di sel aktif; Enter/F2 edit; Enter simpan & turun; Tab/Shift+Tab ke kanan/kiri; Esc batal; panah pindah sel; Ctrl+End ke baris baru.
- Jenis: tekan **M**/**K**, atau Enter untuk menukar. Nominal: `35000`, `35.000`, `35rb`, `1,5jt`; angka minus = Keluar.
- Baris terakhir = baris baru; tersimpan otomatis begitu Nominal diisi. Tanggal & jenis terakhir dipakai lagi untuk baris berikutnya.
- Pilih baris lewat nomor baris (Shift = rentang, Ctrl = tambah); Delete hapus (dengan konfirmasi).
- Ctrl+C menyalin sel/baris terpilih (TSV). Ctrl+V dari Excel/Sheets: dipetakan mulai kolom aktif; header dilewati; format tanggal d/m/y Indonesia, "21 Okt", serial Excel; nominal "Rp1.250.000"/"(50.000)"; kategori dicocokkan berdasarkan nama. Paste bersifat atomik (semua atau tidak sama sekali).
- Simpan optimistik; bila server menolak, nilai dikembalikan dan muncul pesan.
- Warna Masuk = teal `#0d9488`, Keluar = oranye `#ea580c` (pasangan aman buta warna, sudah divalidasi untuk mode terang & gelap). Merah hanya untuk saldo/selisih negatif.

## 7. Batasan yang diketahui

- Belum ada pencarian/filter di dalam sheet (tidak diminta).
- Tidak ada undo (Ctrl+Z); penghapusan memakai konfirmasi.
- Di layar ponsel, grid digeser horizontal (lebar minimum 920 px) — perilaku wajar untuk spreadsheet.
- Paste maksimal 1000 baris per sekali tempel.
