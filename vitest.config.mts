import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" melempar error di luar React Server; di test cukup modul kosong.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/support/env.ts"],
    fileParallelism: false, // integration test berbagi satu database test
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
