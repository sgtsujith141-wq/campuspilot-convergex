// Deletes the local demo database; it is recreated from the seed on the next request.
import { rmSync } from "node:fs";
import path from "node:path";

const file = process.env.CAMPUSPILOT_DB_PATH || path.join(process.cwd(), ".data", "campuspilot.db");
for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
console.log(`Removed ${file} (re-seeded automatically on next start).`);
