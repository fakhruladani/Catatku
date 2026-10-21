import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Isolasi data: Prisma Client mentah hanya boleh dipakai oleh auth & lapisan db.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/db/**", "src/server/auth/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/db/base-client", "@/server/db/base-client"],
              message: "Gunakan forUser(userId) dari @/server/db/scoped (isolasi data per user).",
            },
            {
              group: ["@/generated/prisma/client"],
              importNames: ["PrismaClient"],
              message: "Jangan membuat PrismaClient sendiri; gunakan forUser(userId).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"]),
]);

export default eslintConfig;
