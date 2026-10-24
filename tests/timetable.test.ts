import { describe, expect, it } from "vitest";
import { projectAttendance } from "@/lib/core/attendance";
import { attendanceWindow, overlappingSessions, type ClassSession } from "@/lib/core/timetable";
import { scenario } from "@/lib/scenario";
import { MAYA_TIMETABLE } from "@/lib/server/seed";

const sessions = MAYA_TIMETABLE.sessions as ClassSession[];
const event = { start: scenario.opportunity.start, end: scenario.opportunity.end };
const partial = MAYA_TIMETABLE.plannedPartialWindow;

describe("synthetic timetable explains the seed's attendance numbers", () => {
  it("each course's future sessions match futureScheduled", () => {
    for (const c of scenario.courses) expect(sessions.filter((s) => s.courseId === c.id)).toHaveLength(c.futureScheduled);
  });
  it("interval overlap per option reproduces missesByOption for every course", () => {
    for (const option of ["full", "partial", "defer"] as const) {
      const hit = overlappingSessions(sessions, attendanceWindow(option, event, partial));
      for (const c of scenario.courses) expect(hit.filter((s) => s.courseId === c.id).length, `${c.id} ${option}`).toBe(c.missesByOption[option]);
    }
  });
  it("so the projections stay 74.2 / 77.4 / 80.6 for Network Security", () => {
    const ns = scenario.courses.find((c) => c.id === "course_ns")!;
    const pct = (option: "full" | "partial" | "defer") => {
      const misses = overlappingSessions(sessions, attendanceWindow(option, event, partial)).filter((s) => s.courseId === "course_ns").length;
      const p = projectAttendance({ attended: ns.attended, total: ns.total, futureScheduled: ns.futureScheduled, misses });
      return p.kind === "value" ? p.percent.toFixed(1) : "?";
    };
    expect([pct("full"), pct("partial"), pct("defer")]).toEqual(["74.2", "77.4", "80.6"]);
  });
  it("full participation clashes with exactly the expected classes", () => {
    expect(overlappingSessions(sessions, event).map((s) => s.id)).toEqual(["cls_ns_1029", "cls_db_1029", "cls_ns_1030"]);
    expect(overlappingSessions(sessions, partial).map((s) => s.id)).toEqual(["cls_ns_1029"]);
    expect(overlappingSessions(sessions, null)).toEqual([]);
  });
  it("intervals that only touch do not overlap (real intersection, not text matching)", () => {
    const s = [{ ...sessions[0], start: "2026-10-29T09:00:00+05:30", end: "2026-10-29T10:00:00+05:30" }];
    expect(overlappingSessions(s, { start: "2026-10-29T10:00:00+05:30", end: "2026-10-29T13:00:00+05:30" })).toEqual([]);
    expect(overlappingSessions(s, { start: "2026-10-29T09:59:00+05:30", end: "2026-10-29T13:00:00+05:30" })).toHaveLength(1);
  });
});
