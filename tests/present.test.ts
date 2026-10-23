import { describe, expect, it } from "vitest";
import { useTempDb } from "./support/setup-db";

// The UI's derived labels (attention items, timeline, summary, step names) come from data,
// never from hard-coded counts or dates. Exercised against real workspace snapshots.
useTempDb();

const { getAppDb } = await import("@/lib/server/app");
const { run } = await import("@/lib/server/db");
const { MAYA_ID } = await import("@/lib/server/seed");
const { applySourceChange, approveMission, evaluateMission } = await import("@/lib/server/services");
const { workspaceSnapshot } = await import("@/lib/server/workspace");
const { attentionItems, groupByDay, missionState, stepLabel, summaryLine, timelineEntries, timelineRange } = await import("@/lib/present");

const db = getAppDb();
const snap = () => workspaceSnapshot(db, MAYA_ID);

describe("derived home state", () => {
  it("fresh scenario: three attention items, derived summary and timeline", () => {
    const ws = snap();
    expect(attentionItems(ws).map((i) => i.id)).toEqual(["registration", "deadline", "attendance"]);
    expect(summaryLine(ws)).toBe("3 courses tracked · 1 decision to evaluate · 3 items need attention");
    const entries = timelineEntries(ws);
    expect(entries.map((e) => e.id)).toEqual(["reg", "event", "assignment", "assessment"]);
    expect(timelineRange(entries)).toBe("Oct 27–31");
    expect(groupByDay(entries).map((g) => g.day)).toEqual(["2026-10-27", "2026-10-29", "2026-10-31"]);
    expect(missionState(ws.mission)).toBe("none");
  });

  it("approval adds planned work blocks to the timeline and changes the state", () => {
    const { missionId } = evaluateMission(db, MAYA_ID, { missionType: "event_participation", opportunityId: "opp_cyberforge" });
    let ws = snap();
    expect(missionState(ws.mission)).toBe("awaiting");
    expect(attentionItems(ws)[0].id).toBe("review");
    const m = ws.mission!;
    approveMission(db, MAYA_ID, missionId, { revision: 1, optionId: "partial", actionIds: m.drafts.partial.map((d) => d.id), challenge: m.challenge, idempotencyKey: "present-0001" });
    ws = snap();
    expect(missionState(ws.mission)).toBe("approved");
    expect(timelineEntries(ws).filter((e) => e.kind === "work")).toHaveLength(2);
    expect(attentionItems(ws).map((i) => i.id)).toContain("od");
  });

  it("a source change flips the state to needs-review and the deadline item to 'moved'", () => {
    applySourceChange(db, MAYA_ID, "advance_assignment_deadline");
    const ws = snap();
    expect(missionState(ws.mission)).toBe("needs_review");
    const ids = attentionItems(ws).map((i) => i.id);
    expect(ids[0]).toBe("replan");
    expect(attentionItems(ws).find((i) => i.id === "deadline")!.title).toMatch(/now due earlier/);
    expect(timelineEntries(ws).find((e) => e.id === "assignment")!.changed).toBe(true);
    expect(summaryLine(ws)).toMatch(/1 decision open/);
  });

  it("dates and ranges follow the data across a year boundary (nothing hard-coded)", () => {
    run(
      db,
      "UPDATE source_records SET payload_json = json_set(payload_json, '$.start', '2026-12-31T10:00:00+05:30', '$.end', '2027-01-02T17:00:00+05:30', '$.registrationDeadline', '2026-12-30T23:59:00+05:30') WHERE id = 'opp_cyberforge'",
    );
    const ws = snap();
    const entries = timelineEntries(ws);
    expect(timelineRange(entries)).toBe("Oct 28 – Dec 31");
    expect(entries.find((e) => e.id === "event")!.detail).toBe("Event · Dec 31, 2026 – Jan 2, 2027");
  });
});

describe("activity step labels", () => {
  const base = { seq: 1, startedAt: "2026-10-23T00:00:00Z", completedAt: null, durationMs: 0, status: "succeeded", mode: "deterministic" as const, evidenceRefs: [], error: null, requestedBy: null };
  it("maps recorded tools and checkpoints to readable labels", () => {
    expect(stepLabel({ ...base, actor: "Academic specialist", tool: "get_my_courses", summary: "", args: {} })).toBe("Read course records");
    expect(stepLabel({ ...base, actor: "Constraint evaluator", tool: "calculate_attendance", summary: "", args: { optionId: "full" } })).toBe("Calculated attendance · Attend full event");
    expect(stepLabel({ ...base, actor: "Source watcher", tool: null, summary: "SOURCE_UPDATED: x", args: null })).toBe("Detected a source update");
    expect(stepLabel({ ...base, actor: "Source watcher", tool: null, summary: "This mission (revision 1)…", args: null })).toBe("Identified the affected plan");
    expect(stepLabel({ ...base, actor: "Approval gateway", tool: null, summary: "Invalidated 1 approval", args: null })).toBe("Invalidated the outdated approval");
    expect(stepLabel({ ...base, actor: "Permission checkpoint", tool: null, summary: "", args: null })).toBe("Requested your approval");
    expect(stepLabel({ ...base, actor: "Permission checkpoint", tool: null, summary: "Read-only investigation: nothing changed", args: null })).toBe("Confirmed nothing was changed");
    expect(stepLabel({ ...base, actor: "Local AI coordinator", tool: null, summary: "", args: { model: "m" } })).toBe("Local model interpreted the question");
  });
});
