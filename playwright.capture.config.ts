import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Multi-size screenshot capture for visual review and docs: `npm run screenshots`.
// Uses its own database and port so it never touches the demo or e2e data.
const DB = path.join(process.cwd(), ".data", "capture.db");
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.capture.ts",
  workers: 1,
  timeout: 180_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"] },
  webServer: {
    command: `rm -f "${DB}" "${DB}-wal" "${DB}-shm" && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/overview`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { CAMPUSPILOT_DB_PATH: DB, CAMPUSPILOT_DEMO_MODE: "on" },
  },
});
