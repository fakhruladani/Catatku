# Catatan per fase

## 21 Okt 2026 — Versi 2: buku kas ala spreadsheet (perombakan total)
Permintaan: fokus ke kas masuk/keluar berbentuk spreadsheet, bukan aplikasi dompet.

**Dihapus**: dompet, transfer, investasi, target tabungan, utang-piutang, net worth, transaksi berulang, dashboard widget (skema & kode). Database VPS di-reset (isinya hanya data demo).

**Dibuat**
- Skema baru (10 tabel): `Transaction` (jenis Masuk/Keluar + nominal), `Category`, `Budget`, `UserPreference` (saldo awal) + tabel auth. FK transaksi→kategori menyertakan jenis, sehingga DB menolak kategori yang tidak cocok.
- Sheet bulan ala Excel dengan tab bawah Jan–Des per tahun: edit langsung di sel, navigasi keyboard, paste banyak baris dari Excel/Google Sheets, salin, hapus baris, saldo berjalan, total.
- Tab Rekap Bulanan, Rekap Tahunan (grafik + pivot kategori × bulan), Anggaran (editable, berlaku ke depan), Kategori.
- Ekspor Excel per tahun: 12 sheet bulan dengan rumus saldo berjalan & SUMIF + sheet Rekap Tahunan.
- Onboarding diganti: profil → saldo awal → kategori → tanggal awal bulan.
- Seed demo baru (budi@ / sari@demo.catatku) dengan anggaran.
- Test: 120 (unit: uang, periode, saldo berjalan, rekap/pivot/anggaran, parser paste & nominal; integration: isolasi lintas-user untuk semua service, buku kas end-to-end, ekspor, auth) + uji browser (Playwright) untuk alur ketik, edit, paste, hapus, semua tab, ekspor, registrasi.

**Asumsi**
- Satu kolom Nominal (selalu positif) + kolom Jenis; ketik angka minus = otomatis Keluar.
- Saldo berjalan memakai satu "Saldo awal" global (Pengaturan), diteruskan antar bulan.
- Anggaran hanya untuk kategori pengeluaran; nominal berlaku untuk bulan itu dan seterusnya sampai diubah.
- Paste yang dimulai di baris yang sudah ada akan **menimpa** baris-baris di bawahnya (seperti Excel), sisanya jadi baris baru.

## 21 Okt 2026 — Dibuka untuk publik (uji coba)
- Deploy uji coba di VPS: Caddy + HTTPS Let's Encrypt, firewall 22/80/443, aplikasi hanya mendengar di localhost.
- Diverifikasi dari internet: redirect HTTP→HTTPS, sertifikat valid, login, cookie `__Secure-`, Origin asing ditolak (403), registrasi baru + onboarding.

## Fase 1 — selesai 21 Okt 2026

**Dibuat**
- Proyek Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui; Prisma 7 + PostgreSQL 16.
- Skema lengkap 20 tabel (semua modul, termasuk yang dipakai fase berikutnya) + 16 CHECK constraint; satu migrasi `init`.
- Auth (Better Auth): registrasi (indikator kekuatan password), verifikasi email (bisa dimatikan `EMAIL_VERIFICATION=false`), login, logout, lupa/reset password, rate limiting, argon2id, cookie httpOnly.
- Isolasi data: `forUser()` extension + composite FK + ESLint + test.
- Provisioning user baru: `UserPreference` default + SALINAN 40 kategori default (termasuk 2 kategori sistem investasi).
- Onboarding 4 langkah (nama panggilan & foto, dompet pertama, pilih kategori, tanggal awal bulan), bisa dilewati, pengingat di dashboard.
- Dompet: tambah/ubah/arsip/pulihkan/hapus (hapus hanya jika belum dipakai), saldo dihitung dari ledger, set dompet default Quick Add.
- Kategori: tambah/ubah/arsip/pulihkan, subkategori 1 level, kategori sistem terkunci.
- Preferensi (disimpan di DB): tema, tanggal awal bulan, dompet default, urutan & visibilitas widget dashboard.
- Seed demo: `budi@demo.catatku` (awal bulan 25) & `sari@demo.catatku` (awal bulan 1), ±6 bulan transaksi + saham, reksa dana, emas, kripto, SBN.
- Test: 71 test (unit: uang, periode, saldo, extension isolasi; integration: isolasi lintas-user, auth).

**Asumsi yang diambil**
- Nama periode = bulan tempat periode berakhir (sesuai contoh spesifikasi: 25 Sep–24 Okt = Oktober).
- Saldo awal dompet boleh negatif (rekening minus/paylater).
- Mengarsipkan kategori induk ikut mengarsipkan subkategorinya; memulihkan tidak otomatis.
- Onboarding langkah 3: kategori yang tidak dicentang dihapus bila belum dipakai, diarsipkan bila sudah dipakai; mencentang subkategori otomatis mempertahankan induknya.
- Dompet pertama otomatis menjadi dompet default Quick Add.
- Dashboard Fase 1 hanya sapaan + total saldo; widget lengkap di Fase 4.
- Foto profil tidak di-resize.

**Belum (sesuai rencana fase)**: transaksi, anggaran, investasi UI, net worth, rekap, ekspor, target, utang, 2FA, sesi aktif, hapus akun.
