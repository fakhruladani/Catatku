# Catatku

**Buku kas masuk & keluar berbentuk spreadsheet** — catat pemasukan dan pengeluaran langsung di tabel seperti Excel, kelompokkan per kategori, lalu lihat rekap bulanan dan tahunan. Multi-user: setiap akun hanya bisa melihat datanya sendiri.

Mata uang Rupiah (`Rp1.250.000`), bahasa Indonesia, zona waktu Asia/Jakarta.

![Buku kas Oktober](docs/screenshots/buku-kas.png)

## Fitur

| | |
|---|---|
| **Sheet per bulan** | Tab bawah Jan–Des ala workbook Excel. Kolom: Tanggal · Keterangan · Jenis (Masuk/Keluar) · Kategori · Nominal · Saldo berjalan. |
| **Isi seperti Excel** | Ketik langsung di sel, Enter/Tab/panah untuk pindah, `M`/`K` untuk jenis, nominal bisa `35000`, `35.000`, `35rb`, `1,5jt` (angka minus = Keluar). Tersimpan otomatis. |
| **Copy–paste** | Tempel banyak baris dari Excel/Google Sheets (tanggal format Indonesia, `Rp1.250.000`, nama kategori dikenali). Ctrl+C untuk menyalin sel/baris. |
| **Kategori** | Kategori pemasukan & pengeluaran dengan subkategori (1 level), bisa diarsipkan. |
| **Rekap Bulanan** | Total masuk/keluar/selisih, saving rate, perbandingan dengan bulan lalu, rincian per kategori, top 5 pengeluaran, status anggaran. |
| **Rekap Tahunan** | Grafik masuk vs keluar per bulan, ringkasan 12 bulan, tabel kategori × bulan, rata-rata bulanan, bulan paling boros. |
| **Anggaran** | Batas pengeluaran per kategori, berlaku ke bulan-bulan berikutnya sampai diubah; peringatan di 80% dan 100%. |
| **Ekspor Excel** | Workbook satu tahun: 12 sheet bulan (dengan rumus saldo & total) + sheet Rekap Tahunan. |
| **Tanggal awal bulan** | Bulan keuangan bisa dimulai tanggal 1–28 (mis. tanggal gajian 25 → "Oktober" = 25 Sep–24 Okt). |
| **Akun** | Daftar, verifikasi email, login, lupa/reset password, rate limit login, mode gelap, responsif. |

| Rekap bulanan | Rekap tahunan |
|---|---|
| ![Rekap bulanan](docs/screenshots/rekap-bulanan.png) | ![Rekap tahunan](docs/screenshots/rekap-tahunan.png) |

| Anggaran | Ponsel (mode gelap) |
|---|---|
| ![Anggaran](docs/screenshots/anggaran.png) | ![Ponsel](docs/screenshots/mobile-dark.png) |

## Teknologi

Next.js 16 (App Router) · TypeScript · PostgreSQL 16 · Prisma 7 · Better Auth · Tailwind CSS 4 + shadcn/ui · Zod · Recharts · ExcelJS · Vitest

---

## Instalasi (komputer lokal)

### 1. Prasyarat

| Perangkat | Versi | Cek |
|---|---|---|
| [Node.js](https://nodejs.org) | 22 LTS (minimal 20.19) | `node -v` |
| npm | ikut Node.js | `npm -v` |
| [PostgreSQL](https://www.postgresql.org/download/) | 16 (14+ juga bisa) | `psql --version` |
| [Git](https://git-scm.com) | apa saja | `git --version` |

<details>
<summary><b>Cara memasang PostgreSQL</b></summary>

- **Windows**: unduh installer dari postgresql.org (EDB). Catat password user `postgres` saat instalasi. Perintah `psql` ada di "SQL Shell (psql)".
- **macOS**: `brew install postgresql@16 && brew services start postgresql@16`
- **Ubuntu/Debian**: `sudo apt install postgresql` lalu `sudo systemctl enable --now postgresql`
- **Docker** (semua OS):
  ```bash
  docker run -d --name catatku-db -p 5432:5432 \
    -e POSTGRES_USER=catatku -e POSTGRES_PASSWORD=catatku -e POSTGRES_DB=catatku postgres:16
  docker exec -it catatku-db psql -U catatku -c "CREATE DATABASE catatku_test;"
  ```
  (Jika memakai Docker, lewati langkah 3.)
</details>

### 2. Ambil kode & pasang dependensi

```bash
git clone https://github.com/fakhruladani/catatku.git
cd catatku
npm install          # otomatis menjalankan `prisma generate`
```

### 3. Buat database

Masuk ke `psql` sebagai superuser (`sudo -u postgres psql` di Linux, atau "SQL Shell" di Windows), lalu:

```sql
CREATE USER catatku WITH PASSWORD 'catatku' CREATEDB;
CREATE DATABASE catatku OWNER catatku;
CREATE DATABASE catatku_test OWNER catatku;   -- hanya untuk menjalankan test
```

### 4. Atur environment

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Buka `.env` lalu isi minimal:

```env
DATABASE_URL="postgresql://catatku:catatku@localhost:5432/catatku"
BETTER_AUTH_SECRET="isi-string-acak-minimal-32-karakter"
BETTER_AUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
EMAIL_VERIFICATION="false"    # development: akun langsung aktif
EMAIL_TRANSPORT="console"     # email (verifikasi/reset) dicetak di terminal
```

Membuat secret acak: `openssl rand -base64 32` atau
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

### 5. Siapkan tabel & data contoh

```bash
npm run db:deploy    # membuat semua tabel
npm run db:seed      # opsional: 2 akun demo berisi ±6 bulan data
```

### 6. Jalankan

```bash
npm run dev
```

Buka **http://localhost:3000**, lalu daftar akun baru atau masuk dengan akun demo (password `Demo12345!`):

| Email | Tanggal awal bulan |
|---|---|
| `budi@demo.catatku` | 25 |
| `sari@demo.catatku` | 1 |

> Seed bersifat idempoten: akun demo lama dihapus beserta datanya lalu dibuat ulang. **Jangan** jalankan seed di server produksi, atau hapus akun demo setelahnya.

---

## Environment variables

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ✔ | Koneksi PostgreSQL |
| `BETTER_AUTH_SECRET` | ✔ | String acak ≥ 32 karakter. Rahasia — jangan di-commit |
| `BETTER_AUTH_URL`, `APP_URL` | ✔ | URL aplikasi, mis. `https://catatku.domainmu.com` |
| `EMAIL_VERIFICATION` | | `false` = akun aktif tanpa verifikasi (development). Default aktif |
| `EMAIL_TRANSPORT` | | `console` (default) · `resend` · `memory` (test) |
| `RESEND_API_KEY`, `EMAIL_FROM` | jika `resend` | Domain pengirim harus terverifikasi di [Resend](https://resend.com) |
| `RATE_LIMIT` | | `true` untuk mengaktifkan rate limit di development (selalu aktif di production) |
| `UPLOAD_DIR` | | Folder foto profil. Default `./.uploads` |

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server development (http://localhost:3000) |
| `npm run build` lalu `npm start` | Build & jalankan mode produksi |
| `npm run typecheck` · `npm run lint` | Cek TypeScript & ESLint |
| `npm run db:deploy` | Terapkan migrasi database |
| `npm run db:migrate` | Buat migrasi baru setelah mengubah `prisma/schema.prisma` |
| `npm run db:seed` | Isi data demo |
| `npm test` | Semua test (butuh database `catatku_test`) |

### Menjalankan test

```bash
cp .env.example .env.test
# ubah di .env.test:
#   DATABASE_URL=".../catatku_test"
#   EMAIL_VERIFICATION="true"
#   EMAIL_TRANSPORT="memory"
npm run db:test:prepare
npm test
```

Test mencakup perhitungan (saldo berjalan, periode bulan, rekap, anggaran, parser paste), alur auth, ekspor Excel, dan **isolasi data antar-user** untuk setiap fungsi service.

---

## Deploy ke server

Panduan lengkap (Ubuntu + PostgreSQL + systemd + Caddy/HTTPS): **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Struktur proyek

```
prisma/              schema, migrasi, CHECK constraint (sql/checks.sql), seed
src/app/             halaman: (auth)/ masuk-daftar, (app)/ buku, rekap, rekap-tahunan, anggaran, kategori, pengaturan
src/app/api/         auth, ekspor xlsx, avatar
src/features/<modul> schemas (Zod) · service (logika) · actions (Server Actions) · components
src/server/          auth, db (client ter-scope per user), email, helper action
src/lib/             uang (bigint), periode, kalkulasi buku kas & rekap, parser paste
tests/               unit & integration (Vitest)
docs/                DESAIN.md (keputusan teknis), DEPLOY.md, CHANGELOG.md
```

## Keamanan & privasi data

- Nominal disimpan sebagai `BIGINT` rupiah utuh (tidak ada float).
- Setiap query otomatis disaring ke user yang login (Prisma extension); database juga menolak data yang merujuk milik user lain (composite foreign key) dan kategori yang jenisnya tidak cocok.
- Password di-hash argon2id; cookie sesi httpOnly; login & reset password dibatasi (rate limit); proteksi CSRF via validasi Origin.

Detail desain: [docs/DESAIN.md](docs/DESAIN.md).

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `P1001: Can't reach database server` | PostgreSQL belum jalan atau `DATABASE_URL` salah |
| `permission denied for schema public` | Jadikan user `catatku` pemilik database (`CREATE DATABASE ... OWNER catatku`) |
| Login gagal "Email belum diverifikasi" | Set `EMAIL_VERIFICATION="false"` (dev), atau lihat tautan verifikasi di terminal (`EMAIL_TRANSPORT=console`) |
| Port 3000 dipakai | `npm run dev -- -p 3001` (ubah juga `BETTER_AUTH_URL`/`APP_URL`) |
| Login di production gagal di `http://` | Mode produksi memakai cookie `Secure`: wajib HTTPS (atau `localhost`) |
