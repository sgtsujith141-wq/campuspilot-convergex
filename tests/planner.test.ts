import { describe, expect, it } from "vitest";
import { diffPlans, semanticallyEqual } from "@/lib/core/diff";
import { CLOSING_SOON_HOURS, evaluatePlan, findConflicts, latestEveningBlock, registrationStatus } from "@/lib/core/planner";
import { formatBlock, formatDateRange, formatIst, formatIstWeekday, istIso, toMs } from "@/lib/core/time";
import { assignmentSeed, seedFacts } from "@/lib/scenario";

const original = () => evaluatePlan(seedFacts());
const advanced = () => evaluatePlan(seedFacts({ assignmentDueAt: assignmentSeed().modifiedDemoDueAt }));
const opt = (r: ReturnType<typeof original>, id: string) => r.options.find((o) => o.id === id)!;
const ns = (r: ReturnType<typeof original>, id: string) => opt(r, id).projections.find((p) => p.courseId === "course_ns")!;

describe("time handling (Asia/Kolkata)", () => {
  it("requires explicit offsets and formats in IST regardless of host TZ", () => {
    expect(() => toMs("2026-10-29T18:00:00")).toThrow();
    expect(formatIst("2026-10-29T18:00:00+05:30")).toBe("Oct 29, 6:00 PM");
    expect(formatIst("2026-10-29T12:30:00Z")).toBe("Oct 29, 6:00 PM");
    expect(istIso(2026, 10, 28, 19, 0)).toBe("2026-10-28T19:00:00+05:30");
  });
  it("handles a cross-midnight interval", () => {
    const b = latestEveningBlock(toMs("2026-10-30T01:00:00+05:30"), toMs("2026-10-22T21:00:00+05:30"), 3, [
      { start: toMs("2026-10-29T20:00:00+05:30"), end: toMs("2026-10-30T02:00:00+05:30") },
    ]);
    expect(b).toEqual({ start: "2026-10-28T18:00:00+05:30", end: "2026-10-28T21:00:00+05:30" });
  });
  it("never fabricates a slot before the planning time", () => {
    expect(latestEveningBlock(toMs("2026-10-22T22:00:00+05:30"), toMs("2026-10-22T21:00:00+05:30"), 3)).toBeNull();
  });
});

describe("decision engine — seed scenario", () => {
  it("returns three options sharing one source set", () => {
    const r = original();
    expect(r.options.map((o) => o.id)).toEqual(["full", "partial", "defer"]);
    const sets = r.options.map((o) => JSON.stringify([...o.evidenceRefs].sort()));
    expect(new Set(sets).size).toBe(1);
  });
  it("Network Security projections 74.2 / 77.4 / 80.6", () => {
    const r = original();
    expect(ns(r, "full").percent).toBeCloseTo(74.193548, 5);
    expect(ns(r, "partial").percent).toBeCloseTo(77.419355, 5);
    expect(ns(r, "defer").percent).toBeCloseTo(80.645161, 5);
  });
  it("full is a numeric shortfall flag (sample policy), not a verified hard violation", () => {
    const full = opt(original(), "full");
    expect(full.numericStatus).toBe("NOT_OK_NUMERIC_ONLY");
    expect(full.hardViolations).toEqual([]);
    expect(full.flags[0]).toMatch(/sample policy/);
  });
  it("a verified official policy turns the shortfall into a hard violation", () => {
    const f = seedFacts();
    f.policy = { ...f.policy!, isOfficial: true, ref: { ...f.policy!.ref, verification: "verified" } };
    expect(opt(evaluatePlan(f), "full").hardViolations.length).toBe(1);
  });
  it("recommends selected sessions conditionally, with unknown conditions kept visible", () => {
    const r = original();
    expect(r.recommendation.optionId).toBe("partial");
    expect(r.recommendation.conditional).toBe(true);
    expect(r.recommendation.ranking).toEqual(["partial", "defer", "full"]);
    const ids = opt(r, "partial").unknownConditions.map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining(["event_eligibility", "od_approval", "attendance_regulation"]));
    expect(opt(r, "partial").unknownConditions.every((u) => u.status === "NEEDS_VERIFICATION")).toBe(true);
  });
  it("missing policy keeps every option in NEEDS_VERIFICATION", () => {
    const f = seedFacts();
    f.policy = null;
    const r = evaluatePlan(f);
    for (const o of r.options) expect(o.numericStatus).toBe("NEEDS_VERIFICATION");
  });
  it("action plans have 3–4 approval-gated local tasks", () => {
    for (const o of original().options) {
      expect(o.tasks.length).toBeGreaterThanOrEqual(3);
      expect(o.tasks.length).toBeLessThanOrEqual(4);
      expect(o.tasks.every((t) => t.type === "create_local_task")).toBe(true);
    }
  });
  it("original deadline (Oct 29 6 PM) falls during the event → work block Oct 28", () => {
    const r = original();
    expect(r.conflicts.map((c) => c.kind)).toContain("DEADLINE_DURING_EVENT");
    const t = opt(r, "partial").tasks.find((x) => x.taskKey === "db_project")!;
    expect(formatBlock(t.block!)).toBe("Oct 28, 6–9 PM");
  });
  it("assessment prep block lands after the event and before Oct 31 9 AM", () => {
    const t = opt(original(), "partial").tasks.find((x) => x.taskKey === "assessment_prep")!;
    expect(t.block).toEqual({ start: "2026-10-30T18:00:00+05:30", end: "2026-10-30T21:00:00+05:30" });
  });
  it("a deadline already in the past is flagged, not silently planned", () => {
    const r = evaluatePlan(seedFacts({ assignmentDueAt: "2026-10-21T18:00:00+05:30" }));
    expect(findConflicts(seedFacts({ assignmentDueAt: "2026-10-21T18:00:00+05:30" })).map((c) => c.kind)).toContain("DEADLINE_PASSED");
    expect(opt(r, "partial").tasks.find((t) => t.taskKey === "db_project")!.block).toBeUndefined();
  });
});

describe("replanning — deadline Oct 29 6 PM → Oct 28 7 PM", () => {
  it("changes the plan (work block moves to Oct 27) while projections stay identical", () => {
    const before = original();
    const after = advanced();
    expect(semanticallyEqual(before, after)).toBe(false);
    const t = opt(after, "partial").tasks.find((x) => x.taskKey === "db_project")!;
    expect(formatBlock(t.block!)).toBe("Oct 27, 6–9 PM");
    expect(t.title).toMatch(/by Oct 28, 7:00 PM/);
    const d = diffPlans(before, after, 1, 2);
    expect(d.changed).toBe(true);
    expect(d.facts).toEqual([{ field: "assignmentDueAt", label: "Assignment due", before: "Oct 29, 6:00 PM", after: "Oct 28, 7:00 PM" }]);
    expect(d.tasks.filter((c) => c.optionId === "partial").map((c) => c.taskKey)).toEqual(["db_project"]);
    expect(d.projectionChanges).toEqual([]);
    expect(after.recommendation.optionId).toBe("partial");
  });
  it("restoring the deadline returns to a plan equal to the original", () => {
    expect(semanticallyEqual(original(), evaluatePlan(seedFacts()))).toBe(true);
    expect(diffPlans(original(), evaluatePlan(seedFacts()), 2, 3).changed).toBe(false);
  });
});

describe("registration status (scenario clock)", () => {
  const deadline = "2026-10-27T23:59:00+05:30";
  const minus = (min: number) => new Date(toMs(deadline) - min * 60_000).toISOString();
  it("exactly at the deadline is closed", () => {
    expect(registrationStatus(deadline, deadline).status).toBe("closed");
  });
  it("one minute before is closing soon; the 48-hour boundary is inclusive", () => {
    expect(registrationStatus(minus(1), deadline).status).toBe("closing_soon");
    expect(registrationStatus(minus(CLOSING_SOON_HOURS * 60), deadline).status).toBe("closing_soon");
    expect(registrationStatus(minus(CLOSING_SOON_HOURS * 60 + 1), deadline).status).toBe("open");
  });
  it("a missing deadline is unverified, never open", () => {
    expect(registrationStatus(deadline, null).status).toBe("unverified");
  });
  it("the seed scenario is open with the listing marked unverified", () => {
    expect(original().facts.registration).toMatchObject({ status: "open", sourceVerified: false });
  });
  it("closed registration removes participating options and their registration task", () => {
    const f = seedFacts();
    f.opportunity.registrationDeadline = f.now;
    const r = evaluatePlan(f);
    expect(r.recommendation.optionId).toBe("defer");
    expect(opt(r, "partial").hardViolations[0]).toMatch(/Registration closed .* \(assumes you have not registered yet\)/);
    expect(opt(r, "partial").tasks.map((t) => t.taskKey)).not.toContain("verify_participation");
    expect(r.conflicts.find((c) => c.kind === "REGISTRATION_WINDOW")!.severity).toBe("hard");
  });
  it("closing soon is flagged but does not block", () => {
    const f = seedFacts();
    f.opportunity.registrationDeadline = new Date(toMs(f.now) + 10 * 3600_000).toISOString();
    const r = evaluatePlan(f);
    expect(opt(r, "partial").flags.join(" ")).toMatch(/closes in 10 hours/);
    expect(r.recommendation.optionId).toBe("partial");
  });
});

describe("no unsupported timetable claims", () => {
  it("option copy does not claim to know which classes or sessions are avoided", () => {
    for (const o of original().options) expect(o.description).not.toMatch(/avoid|scheduled .* classes/i);
  });
  it("absence counts are described as scenario estimates derived from data", () => {
    expect(opt(original(), "full").absenceSummary).toBe("Scenario estimate: 2 Network Security classes, 1 Database Systems class.");
    expect(opt(original(), "partial").absenceSummary).toBe("Scenario estimate: 1 Network Security class.");
    expect(opt(original(), "defer").absenceSummary).toBe("No class absences in the scenario data.");
  });
  it("the timetable gap is an explicit unknown on every option", () => {
    for (const o of original().options) expect(o.unknownConditions.map((u) => u.id)).toContain("timetable");
  });
});

describe("planning edge cases", () => {
  it("the preparation block never overlaps the project block", () => {
    const f = seedFacts({ assignmentDueAt: "2026-10-29T18:00:00+05:30" });
    f.assessment = { ...f.assessment, startsAt: "2026-10-29T09:00:00+05:30" };
    const d = opt(evaluatePlan(f), "defer");
    const project = d.tasks.find((t) => t.taskKey === "db_project")!.block!;
    const prep = d.tasks.find((t) => t.taskKey === "assessment_prep")!.block!;
    expect(project).toEqual({ start: "2026-10-28T18:00:00+05:30", end: "2026-10-28T21:00:00+05:30" });
    expect(prep.start).toBe("2026-10-27T18:00:00+05:30");
  });
  it("evidence older than seven days is flagged as stale and kept visible", () => {
    const f = seedFacts();
    f.courses[0] = { ...f.courses[0], ref: { ...f.courses[0].ref, retrievedAt: "2026-10-10T09:00:00+05:30" } };
    const r = evaluatePlan(f);
    expect(r.freshness.stale).toEqual(["course_ns"]);
    expect(opt(r, "partial").unknownConditions.map((u) => u.id)).toContain("source_freshness");
    expect(original().freshness.stale).toEqual([]);
  });
});

describe("date formatting across month and year boundaries", () => {
  it("formats ranges without hard-coded months", () => {
    expect(formatDateRange("2026-10-29T10:00:00+05:30", "2026-10-29T17:00:00+05:30")).toBe("Oct 29");
    expect(formatDateRange("2026-10-29T10:00:00+05:30", "2026-10-30T17:00:00+05:30")).toBe("Oct 29–30");
    expect(formatDateRange("2026-10-30T10:00:00+05:30", "2026-11-02T17:00:00+05:30")).toBe("Oct 30 – Nov 2");
    expect(formatDateRange("2026-12-31T10:00:00+05:30", "2027-01-02T17:00:00+05:30")).toBe("Dec 31, 2026 – Jan 2, 2027");
  });
  it("uses IST calendar days even when the UTC date differs", () => {
    expect(formatDateRange("2026-10-31T20:00:00Z", "2026-11-01T02:00:00Z")).toBe("Nov 1");
    expect(formatIstWeekday("2026-10-22T21:00:00+05:30")).toBe("Thu, Oct 22");
  });
});
