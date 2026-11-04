import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    env: { PGLITE_DIR: "memory://", DATABASE_URL: "" },
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
