/**
 * Membuat akun admin (idempoten).
 *   npm run admin:create                          -> username "admin", password "password"
 *   ADMIN_USERNAME=bos ADMIN_PASSWORD=... npm run admin:create
 *   npm run admin:create -- --reset-password      -> set ulang password admin yang sudah ada
 */
import { createAccount, setAccountPassword } from "../src/server/admin/accounts";
import { basePrisma } from "../src/server/db/base-client";
import { normalizeUsername } from "../src/lib/username";

async function main() {
  const username = normalizeUsername(process.env.ADMIN_USERNAME ?? "admin");
  const password = process.env.ADMIN_PASSWORD ?? "password";
  const reset = process.argv.includes("--reset-password");

  const existing = await basePrisma.user.findUnique({ where: { username }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await basePrisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
      console.info(`User "${username}" dijadikan ADMIN.`);
    }
    if (reset) {
      await setAccountPassword(existing.id, password);
      console.info(`Password admin "${username}" di-set ulang.`);
    } else console.info(`Admin "${username}" sudah ada (password tidak diubah).`);
    return;
  }
  await createAccount({ username, name: "Administrator", password, role: "ADMIN" });
  console.info(`Admin dibuat: username "${username}". Segera ganti password lewat menu Akun saya.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
