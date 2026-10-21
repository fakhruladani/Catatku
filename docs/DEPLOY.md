# Deploy Catatku ke server (Ubuntu 22.04/24.04)

Panduan ini menghasilkan: aplikasi berjalan sebagai service systemd di `127.0.0.1:3000`, PostgreSQL lokal, dan Caddy sebagai reverse proxy dengan HTTPS otomatis (Let's Encrypt).

Kebutuhan minimal: 2 vCPU, 2 GB RAM (+ swap 2 GB untuk proses build), domain yang A record-nya mengarah ke IP server.
Belum punya domain? Untuk uji coba bisa memakai `<ip-dengan-strip>.sslip.io`, mis. `203-0-113-10.sslip.io`.

## 1. Paket sistem

```bash
sudo apt update && sudo apt install -y curl git ca-certificates gnupg ufw

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# PostgreSQL 16 (repo resmi PGDG)
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-16
sudo systemctl enable --now postgresql

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Swap 2 GB (jika RAM < 4 GB)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. Database

```bash
DBPASS=$(openssl rand -hex 16); echo "Simpan password DB ini: $DBPASS"
sudo -u postgres psql -c "CREATE USER catatku WITH PASSWORD '$DBPASS';"
sudo -u postgres psql -c "CREATE DATABASE catatku OWNER catatku;"
```

## 3. Kode & konfigurasi

```bash
cd ~ && git clone https://github.com/fakhruladani/catatku.git && cd catatku
cp .env.example .env && chmod 600 .env
nano .env
```

Isi `.env` (ganti domain & password):

```env
DATABASE_URL="postgresql://catatku:PASSWORD_DB@localhost:5432/catatku"
BETTER_AUTH_SECRET="hasil: openssl rand -base64 32"
BETTER_AUTH_URL="https://catatku.domainmu.com"
APP_URL="https://catatku.domainmu.com"
EMAIL_VERIFICATION="true"
EMAIL_TRANSPORT="resend"
RESEND_API_KEY="re_xxx"
EMAIL_FROM="Catatku <no-reply@domainmu.com>"
UPLOAD_DIR="/home/USER/catatku-data/uploads"
```

> Tanpa layanan email, set `EMAIL_VERIFICATION="false"` dan `EMAIL_TRANSPORT="console"` — tetapi siapa pun bisa mendaftar dengan email apa pun, dan tautan reset password hanya muncul di log server.

```bash
mkdir -p ~/catatku-data/uploads && chmod 700 ~/catatku-data
npm ci
npm run db:deploy
npm run build
```

## 4. Service systemd

```bash
sudo tee /etc/systemd/system/catatku.service > /dev/null <<EOF
[Unit]
Description=Catatku
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/catatku
Environment=NODE_ENV=production
ExecStart=/usr/bin/npx next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable --now catatku
systemctl status catatku --no-pager
```

## 5. Caddy (HTTPS) & firewall

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
catatku.domainmu.com {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
	request_body {
		max_size 5MB
	}
	reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl reload caddy

sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
```

Buka `https://catatku.domainmu.com`. Sertifikat diterbitkan otomatis dalam beberapa detik pertama.

## 6. Update versi

```bash
cd ~/catatku
git pull
npm ci
npm run db:deploy
npm run build
sudo systemctl restart catatku
```

## 7. Operasional

| Perlu | Perintah |
|---|---|
| Log aplikasi | `sudo journalctl -u catatku -f` |
| Log HTTPS/Caddy | `sudo journalctl -u caddy -f` |
| Backup database | `pg_dump -U catatku -h localhost catatku \| gzip > catatku-$(date +%F).sql.gz` |
| Restore | `gunzip -c file.sql.gz \| psql -U catatku -h localhost catatku` |

## Checklist keamanan

- [ ] `BETTER_AUTH_SECRET` acak dan `.env` ber-permission `600`
- [ ] Port 3000 tidak dibuka di firewall (aplikasi hanya mendengar di `127.0.0.1`)
- [ ] Login SSH memakai key; `PasswordAuthentication no` dan `PermitRootLogin no` di `/etc/ssh/sshd_config`
- [ ] Verifikasi email aktif dengan domain pengirim sendiri
- [ ] Akun demo tidak ada di database produksi
- [ ] Backup database terjadwal
