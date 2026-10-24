import { scenario } from "@/lib/scenario";
import { getDb, one, type Db } from "./db";
import { OTHER_FIXTURE } from "./seed";
import { evaluateMission } from "./services";

/**
 * Ensures the second fictional profile owns a mission (fixed ID) so cross-student isolation
 * can be exercised against a real record. Its data is never shown to the signed-in student.
 */
export function ensureFixtures(db: Db) {
  const exists = one(db, "SELECT id FROM missions WHERE id = ?", OTHER_FIXTURE.missionId);
  if (!exists) {
    evaluateMission(
      db,
      OTHER_FIXTURE.studentId,
      { missionType: "event_participation", opportunityId: scenario.opportunity.id },
      OTHER_FIXTURE.missionId,
    );
  }
}

const g = globalThis as unknown as { __campuspilotFixtures?: Db };

export function getAppDb(): Db {
  const db = getDb();
  if (g.__campuspilotFixtures !== db) {
    ensureFixtures(db);
    g.__campuspilotFixtures = db;
  }
  return db;
}
