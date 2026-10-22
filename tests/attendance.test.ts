import { describe, expect, it } from "vitest";
import { currentAttendance, evaluateThreshold, formatPercent, projectAttendance } from "@/lib/core/attendance";
import { scenario } from "@/lib/scenario";

const course = (id: string) => scenario.courses.find((c) => c.id === id)!;
function pct(id: string, option: "full" | "partial" | "defer") {
  const c = course(id);
  const p = projectAttendance({ attended: c.attended, total: c.total, futureScheduled: c.futureScheduled, misses: c.missesByOption[option] });
  if (p.kind !== "value") throw new Error("expected value");
  return p;
}

describe("attendance projection — seed invariants (specs/05)", () => {
  it("Network Security: 23/31, 24/31, 25/31", () => {
    expect(pct("course_ns", "full").percent).toBeCloseTo(74.193548, 5);
    expect(pct("course_ns", "partial").percent).toBeCloseTo(77.419355, 5);
    expect(pct("course_ns", "defer").percent).toBeCloseTo(80.645161, 5);
    expect(pct("course_ns", "full")).toMatchObject({ numerator: 23, denominator: 31 });
  });
  it("Database Systems: 27/35 full, 28/35 otherwise", () => {
    expect(pct("course_db", "full").percent).toBeCloseTo(77.142857, 5);
    expect(pct("course_db", "partial").percent).toBeCloseTo(80.0, 5);
    expect(pct("course_db", "defer").percent).toBeCloseTo(80.0, 5);
  });
  it("Discrete Mathematics: 31/38 for every option", () => {
    for (const o of ["full", "partial", "defer"] as const) expect(pct("course_dm", o).percent).toBeCloseTo(81.578947, 5);
  });
  it("matches the expectedProjections block of the seed for every course and option", () => {
    for (const [option, byCourse] of Object.entries(scenario.expectedProjections)) {
      for (const [courseId, expected] of Object.entries(byCourse)) {
        expect(pct(courseId, option as "full")).toMatchObject({ kind: "value" });
        expect(pct(courseId, option as "full").percent).toBeCloseTo(expected, 5);
      }
    }
  });
  it("UI display rounds to one decimal without feeding rounded values back", () => {
    expect(formatPercent(pct("course_ns", "full").percent)).toBe("74.2%");
    expect(formatPercent(pct("course_ns", "partial").percent)).toBe("77.4%");
    expect(formatPercent(pct("course_ns", "defer").percent)).toBe("80.6%");
  });
});

describe("attendance projection — guards", () => {
  it("zero future meetings equals current attendance", () => {
    const p = projectAttendance({ attended: 21, total: 27, futureScheduled: 0, misses: 0 });
    expect(p.kind === "value" && p.percent).toBeCloseTo((100 * 21) / 27, 8);
  });
  it("zero total sessions returns UNKNOWN, not NaN", () => {
    expect(projectAttendance({ attended: 0, total: 0, futureScheduled: 0, misses: 0 })).toEqual({ kind: "unknown", reason: expect.any(String) });
    expect(currentAttendance(0, 0).kind).toBe("unknown");
  });
  it("misses cannot exceed upcoming meetings", () => {
    expect(() => projectAttendance({ attended: 1, total: 2, futureScheduled: 1, misses: 2 })).toThrow(RangeError);
  });
  it("negative or fractional counts are rejected", () => {
    expect(() => projectAttendance({ attended: -1, total: 2, futureScheduled: 0, misses: 0 })).toThrow(RangeError);
    expect(() => projectAttendance({ attended: 1.5, total: 2, futureScheduled: 0, misses: 0 })).toThrow(RangeError);
  });
  it("attended cannot exceed total", () => {
    expect(() => projectAttendance({ attended: 5, total: 4, futureScheduled: 0, misses: 0 })).toThrow(RangeError);
  });
  it("never exceeds 100%", () => {
    const p = projectAttendance({ attended: 10, total: 10, futureScheduled: 5, misses: 0 });
    expect(p.kind === "value" && p.percent).toBe(100);
  });
  it("missing policy yields NEEDS_VERIFICATION (third state), not pass/fail", () => {
    const p = projectAttendance({ attended: 21, total: 27, futureScheduled: 4, misses: 1 });
    expect(evaluateThreshold(p, null)).toBe("NEEDS_VERIFICATION");
    expect(evaluateThreshold({ kind: "unknown", reason: "x" }, { minimumAttendancePercent: 75 })).toBe("NEEDS_VERIFICATION");
    expect(evaluateThreshold(p, { minimumAttendancePercent: 75 })).toBe("OK_NUMERIC_ONLY");
  });
});
