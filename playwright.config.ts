import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// E2E runs against a production build with its own fresh SQLite file.
export const E2E_DB = path.join(process.cwd(), ".data", "e2e.db");
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.ts",
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `rm -f "${E2E_DB}" "${E2E_DB}-wal" "${E2E_DB}-shm" && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/overview`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { CAMPUSPILOT_DB_PATH: E2E_DB, CAMPUSPILOT_DEMO_MODE: "on" },
  },
});
