import type { OptionId } from "@/lib/contracts";
import { toMs } from "./time";

// Synthetic class timetable and real interval intersection against event attendance windows.

export type ClassSession = {
  id: string;
  courseId: string;
  code: string;
  name: string;
  type: "Lecture" | "Lab";
  start: string;
  end: string;
  room: string;
  instructor: string;
};

export type Window = { start: string; end: string };

/** Sessions whose [start, end) interval intersects the window. */
export function overlappingSessions(sessions: ClassSession[], window: Window | null): ClassSession[] {
  if (!window) return [];
  const ws = toMs(window.start);
  const we = toMs(window.end);
  return sessions.filter((s) => toMs(s.start) < we && ws < toMs(s.end)).sort((a, b) => toMs(a.start) - toMs(b.start));
}

/** Attendance window for an option: full = whole event, partial = guided selected-session window, defer = none. */
export function attendanceWindow(option: OptionId, event: Window, partial: Window): Window | null {
  return option === "full" ? event : option === "partial" ? partial : null;
}
