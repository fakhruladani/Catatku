#!/usr/bin/env node
// Pemakaian: node scripts/with-env.mjs <file.env> <perintah> [arg...]
// Menjalankan perintah dengan variabel dari file .env (menimpa env yang ada).
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

const [file, cmd, ...args] = process.argv.slice(2);
if (!file || !cmd) {
  console.error("Pemakaian: node scripts/with-env.mjs <file.env> <perintah> [arg...]");
  process.exit(1);
}
config({ path: file, override: true, quiet: true });
const res = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(res.status ?? 1);
