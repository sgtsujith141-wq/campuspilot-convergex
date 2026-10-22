import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname, "server-only": `${import.meta.dirname}/tests/support/empty.ts` } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    pool: "forks",
  },
});
