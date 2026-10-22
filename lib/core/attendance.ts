import type { NumericStatus } from "@/lib/contracts";

export type AttendanceInput = {
  /** A — sessions attended so far */
  attended: number;
  /** T — sessions held so far */
  total: number;
  /** H — future scheduled class meetings in the planning window */
  futureScheduled: number;
  /** M — future meetings missed because of the evaluated option */
  misses: number;
};

export type Projection =
  | { kind: "value"; percent: number; numerator: number; denominator: number }
  | { kind: "unknown"; reason: string };

function assertCount(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (got ${value})`);
  }
}

/**
 * projected = 100 × (A + H − M) / (T + H)
 * Assumes every other future scheduled meeting is attended. Returns UNKNOWN (never NaN)
 * when there is nothing to divide by. Invalid inputs throw instead of being clamped.
 */
export function projectAttendance(input: AttendanceInput): Projection {
  const { attended: A, total: T, futureScheduled: H, misses: M } = input;
  assertCount("attended", A);
  assertCount("total", T);
  assertCount("futureScheduled", H);
  assertCount("misses", M);
  if (A > T) throw new RangeError(`attended (${A}) cannot exceed total (${T})`);
  if (M > H) throw new RangeError(`misses (${M}) cannot exceed future scheduled meetings (${H})`);
  const denominator = T + H;
  if (denominator === 0) return { kind: "unknown", reason: "No held or scheduled sessions" };
  const numerator = A + H - M;
  return { kind: "value", percent: (100 * numerator) / denominator, numerator, denominator };
}

export function currentAttendance(attended: number, total: number): Projection {
  return projectAttendance({ attended, total, futureScheduled: 0, misses: 0 });
}

/**
 * Third-state evaluation. A missing policy (or an unknown projection) is NEEDS_VERIFICATION,
 * never a pass or a fail. Even a numeric pass only says "OK_NUMERIC_ONLY": arithmetic is not
 * eligibility.
 */
export function evaluateThreshold(
  projection: Projection,
  policy: { minimumAttendancePercent: number } | null | undefined,
): NumericStatus {
  if (!policy || !Number.isFinite(policy.minimumAttendancePercent)) return "NEEDS_VERIFICATION";
  if (projection.kind === "unknown") return "NEEDS_VERIFICATION";
  return projection.percent >= policy.minimumAttendancePercent ? "OK_NUMERIC_ONLY" : "NOT_OK_NUMERIC_ONLY";
}

/** Display helper: one decimal, computed from the unrounded value. */
export function formatPercent(percent: number | null): string {
  return percent === null ? "Unknown" : `${percent.toFixed(1)}%`;
}
