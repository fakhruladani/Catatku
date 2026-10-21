-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");


-- Peran akun
ALTER TABLE "User" ADD CONSTRAINT "User_role_chk" CHECK ("role" IN ('USER', 'ADMIN'));
-- Username: huruf kecil, angka, titik, garis bawah; 3-30 karakter
ALTER TABLE "User" ADD CONSTRAINT "User_username_chk" CHECK ("username" IS NULL OR "username" ~ '^[a-z0-9_.]{3,30}$');
