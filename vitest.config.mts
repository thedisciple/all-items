import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src") } },
  // SQLite/media fixtures perform real disk work; serialize files to avoid host I/O contention.
  test: { environment: "node", include: ["src/**/*.test.ts"], fileParallelism: false, testTimeout: 30_000, hookTimeout: 120_000 },
});
