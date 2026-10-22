import type {
  Conflict,
  CourseProjection,
  DecisionOption,
  NumericStatus,
  OptionId,
  PlanResult,
  PlanningFacts,
  Recommendation,
  TaskDraft,
  TimeBlock,
  UnknownCondition,
} from "@/lib/contracts";
import { OPTION_IDS } from "@/lib/contracts";
import { evaluateThreshold, formatPercent, projectAttendance } from "./attendance";
import { formatBlock, formatIst, istIso, istParts, msToIst, overlaps, toMs } from "./time";

export const ENGINE_VERSION = "campuspilot-engine/1.0.0";

const HOUR = 3600 * 1000;
/** Suggested work blocks are evening slots; they are proposals, not timetable facts. */
const BLOCK_START_HOUR = 18;
/** Finish project work this many hours before the effective cutoff. */
const PROJECT_BUFFER_HOURS = 12;

const OPTION_COPY: Record<OptionId, { label: string; badge: string; description: string; participates: boolean }> = {
  full: {
    label: "Attend full event",
    badge: "MAXIMUM PARTICIPATION",
    description: "Both days on site. Misses the most scheduled classes and needs the most review.",
    participates: true,
  },
  partial: {
    label: "Attend selected sessions",
    badge: "BALANCED",
    description: "Join the sessions that avoid your scheduled Network Security and Database classes.",
    participates: true,
  },
  defer: {
    label: "Defer participation",
    badge: "ACADEMIC-FIRST",
    description: "Skip this edition, protect study time and look for a later cybersecurity event.",
    participates: false,
  },
};

/**
 * Latest evening block [18:00, 18:00+h) in IST that ends by `limitMs`, starts after `notBeforeMs`
 * and does not overlap any interval in `avoid`. Returns null when no such slot exists in the
 * search window (we never fabricate a slot that breaks those rules).
 */
export function latestEveningBlock(
  limitMs: number,
  notBeforeMs: number,
  hours: number,
  avoid: { start: number; end: number }[] = [],
): TimeBlock | null {
  const p = istParts(limitMs);
  for (let back = 0; back < 14; back++) {
    const startIso = istIso(p.year, p.month, p.day - back, BLOCK_START_HOUR, 0);
    const start = toMs(startIso);
    const end = start + hours * HOUR;
    if (end > limitMs) continue;
    if (start < notBeforeMs) return null;
    if (avoid.some((a) => overlaps({ start, end }, a))) continue;
    return { start: startIso, end: msToIst(end) };
  }
  return null;
}

export function findConflicts(facts: PlanningFacts): Conflict[] {
  const { assignment, assessment, opportunity } = facts;
  const now = toMs(facts.now);
  const due = toMs(assignment.dueAt);
  const evStart = toMs(opportunity.start);
  const evEnd = toMs(opportunity.end);
  const conflicts: Conflict[] = [];

  if (due < now) {
    conflicts.push({
      id: "deadline_passed",
      kind: "DEADLINE_PASSED",
      severity: "hard",
      message: `${assignment.name} was due ${formatIst(assignment.dueAt)}, which is before the planning time.`,
      evidenceRefs: [assignment.ref.id],
    });
  } else if (due >= evStart && due <= evEnd) {
    conflicts.push({
      id: "deadline_during_event",
      kind: "DEADLINE_DURING_EVENT",
      severity: "soft",
      message: `${assignment.name} is due ${formatIst(assignment.dueAt)}, during ${opportunity.name} (${formatIst(opportunity.start)} – ${formatIst(opportunity.end)}). Project work has to finish before the event starts.`,
      evidenceRefs: [assignment.ref.id, opportunity.ref.id],
    });
  } else if (due < evStart) {
    const hoursLeft = Math.round((due - now) / HOUR);
    conflicts.push({
      id: "deadline_before_event",
      kind: "DEADLINE_BEFORE_EVENT",
      severity: "soft",
      message: `${assignment.name} is due ${formatIst(assignment.dueAt)}, before ${opportunity.name} starts — about ${hoursLeft} hours from the planning time.`,
      evidenceRefs: [assignment.ref.id, opportunity.ref.id],
    });
  }

  const gapHours = Math.round((toMs(assessment.startsAt) - evEnd) / HOUR);
  if (gapHours >= 0 && gapHours < 48) {
    conflicts.push({
      id: "prep_after_event",
      kind: "PREP_AFTER_EVENT",
      severity: "soft",
      message: `${assessment.name} starts ${formatIst(assessment.startsAt)}, ${gapHours} hours after the event ends. A ${assessment.studyHoursDesired}-hour preparation block must be protected.`,
      evidenceRefs: [assessment.ref.id, opportunity.ref.id],
    });
  }

  conflicts.push({
    id: "registration_window",
    kind: "REGISTRATION_WINDOW",
    severity: "info",
    message: `Registration closes ${formatIst(opportunity.registrationDeadline)}; eligibility and on-duty approval should be confirmed before then.`,
    evidenceRefs: [opportunity.ref.id],
  });
  return conflicts;
}

function worstStatus(statuses: NumericStatus[]): NumericStatus {
  if (statuses.includes("NOT_OK_NUMERIC_ONLY")) return "NOT_OK_NUMERIC_ONLY";
  if (statuses.includes("NEEDS_VERIFICATION")) return "NEEDS_VERIFICATION";
  return "OK_NUMERIC_ONLY";
}

export function projectCourses(facts: PlanningFacts, optionId: OptionId): CourseProjection[] {
  return facts.courses.map((c) => {
    const misses = c.missesByOption[optionId];
    const p = projectAttendance({ attended: c.attended, total: c.total, futureScheduled: c.futureScheduled, misses });
    return {
      courseId: c.id,
      code: c.code,
      name: c.name,
      attended: c.attended,
      total: c.total,
      futureScheduled: c.futureScheduled,
      misses,
      projectedAttended: c.attended + c.futureScheduled - misses,
      projectedTotal: c.total + c.futureScheduled,
      percent: p.kind === "value" ? p.percent : null,
      status: evaluateThreshold(p, facts.policy),
      evidenceRef: c.ref.id,
    };
  });
}

function unknownConditionsFor(facts: PlanningFacts, participates: boolean): UnknownCondition[] {
  const out: UnknownCondition[] = [];
  if (participates) {
    out.push({
      id: "event_eligibility",
      label: "Event eligibility",
      status: "NEEDS_VERIFICATION",
      reason: `${facts.opportunity.eligibility}. No official event rules have been supplied.`,
      evidenceRef: facts.opportunity.ref.id,
    });
    out.push({
      id: "od_approval",
      label: "On-duty approval",
      status: "NEEDS_VERIFICATION",
      reason: `${facts.opportunity.approval}. Approval is never inferred from the event existing.`,
      evidenceRef: facts.opportunity.ref.id,
    });
  }
  if (!facts.policy || !facts.policy.isOfficial) {
    out.push({
      id: "attendance_regulation",
      label: "Applicable attendance regulation",
      status: "NEEDS_VERIFICATION",
      reason: facts.policy
        ? `The ${facts.policy.minimumAttendancePercent}% threshold is a sample configuration (${facts.policy.appliesTo}), not an official regulation.`
        : "No attendance policy source is available.",
      evidenceRef: facts.policy?.ref.id,
    });
  }
  out.push({
    id: "timetable_slots",
    label: "Suggested time blocks",
    status: "NEEDS_VERIFICATION",
    reason: "No timetable source is connected, so suggested evening blocks are not checked against other commitments.",
  });
  return out;
}

function tasksFor(facts: PlanningFacts, optionId: OptionId, projections: CourseProjection[]): TaskDraft[] {
  const { assignment, assessment, opportunity, policy } = facts;
  const participates = OPTION_COPY[optionId].participates;
  const now = toMs(facts.now);
  const evStart = toMs(opportunity.start);
  const evEnd = toMs(opportunity.end);
  const event = { start: evStart, end: evEnd };
  const tasks: TaskDraft[] = [];

  if (optionId === "full") {
    const short = projections.filter((p) => p.status === "NOT_OK_NUMERIC_ONLY");
    if (short.length > 0) {
      const worst = short[0];
      tasks.push({
        taskKey: "resolve_shortfall",
        type: "create_local_task",
        title: `Resolve the ${worst.name} shortfall before committing`,
        detail: `Projected ${formatPercent(worst.percent)} is below the sample ${policy?.minimumAttendancePercent}% threshold. Do not treat full attendance as approved; consider selected sessions instead.`,
        evidenceRefs: [worst.evidenceRef, ...(policy ? [policy.ref.id] : [])],
      });
    }
  }

  if (participates) {
    tasks.push({
      taskKey: "verify_participation",
      type: "create_local_task",
      title: optionId === "partial" ? "Confirm selected sessions, eligibility and on-duty approval" : "Confirm eligibility and on-duty approval",
      detail: `Check the official event rules and request advance on-duty approval from the appropriate authority before registration closes ${formatIst(opportunity.registrationDeadline)}.`,
      dueAt: opportunity.registrationDeadline,
      evidenceRefs: [opportunity.ref.id],
    });
  } else {
    tasks.push({
      taskKey: "later_event",
      type: "create_local_task",
      title: "Shortlist a later cybersecurity event",
      detail: `Keep current academic commitments and revisit opportunities after the ${formatIst(assessment.startsAt)} assessment.`,
      evidenceRefs: [opportunity.ref.id],
    });
  }

  // Project work: attending options lose the event days, so the effective cutoff is the
  // earlier of the deadline and the event start.
  const due = toMs(assignment.dueAt);
  const cutoff = participates ? Math.min(due, evStart) : due;
  const projectBlock = latestEveningBlock(cutoff - PROJECT_BUFFER_HOURS * HOUR, now, 3, participates ? [event] : []);
  const dueDuringEvent = due >= evStart && due <= evEnd;
  tasks.push({
    taskKey: "db_project",
    type: "create_local_task",
    title: participates && dueDuringEvent ? `Finish ${assignment.name} before the event` : `Complete ${assignment.name} by ${formatIst(assignment.dueAt)}`,
    detail: projectBlock
      ? `Due ${formatIst(assignment.dueAt)}${participates && dueDuringEvent ? ", during the event" : ""}. Suggested work block: ${formatBlock(projectBlock)}. Submission itself is not automated.`
      : `Due ${formatIst(assignment.dueAt)}. No suggested work block fits before the cutoff — needs attention now.`,
    dueAt: assignment.dueAt,
    block: projectBlock ?? undefined,
    evidenceRefs: [assignment.ref.id, ...(participates ? [opportunity.ref.id] : [])],
  });

  const prepBlock = latestEveningBlock(toMs(assessment.startsAt), now, assessment.studyHoursDesired, participates ? [event] : []);
  tasks.push({
    taskKey: "assessment_prep",
    type: "create_local_task",
    title: `Reserve ${assessment.studyHoursDesired}h of ${assessment.name.replace(/ internal assessment$/i, "")} preparation`,
    detail: prepBlock
      ? `Suggested block ${formatBlock(prepBlock)}, before the ${formatIst(assessment.startsAt)} internal assessment${participates ? " and after the event ends" : ""}.`
      : `No suggested block fits before ${formatIst(assessment.startsAt)}.`,
    dueAt: assessment.startsAt,
    block: prepBlock ?? undefined,
    evidenceRefs: [assessment.ref.id],
  });
  return tasks;
}

export function enumerateOptions(facts: PlanningFacts): DecisionOption[] {
  return OPTION_IDS.map((id) => {
    const copy = OPTION_COPY[id];
    const projections = projectCourses(facts, id);
    const numericStatus = worstStatus(projections.map((p) => p.status));
    const policyBinding = !!facts.policy && facts.policy.isOfficial && facts.policy.ref.verification === "verified";
    const hardViolations: string[] = [];
    const flags: string[] = [];
    for (const p of projections) {
      if (p.status !== "NOT_OK_NUMERIC_ONLY") continue;
      const msg = `${p.name} projects ${formatPercent(p.percent)}, below the ${facts.policy?.minimumAttendancePercent}% threshold`;
      if (policyBinding) hardViolations.push(`${msg} (verified policy).`);
      else flags.push(`${msg} of the sample policy (not an official rule).`);
    }
    const tasks = tasksFor(facts, id, projections);
    const unknownConditions = unknownConditionsFor(facts, copy.participates);
    const evidenceRefs = Array.from(
      new Set([
        ...projections.map((p) => p.evidenceRef),
        ...(facts.policy ? [facts.policy.ref.id] : []),
        facts.opportunity.ref.id,
        facts.assignment.ref.id,
        facts.assessment.ref.id,
      ]),
    );
    return {
      id,
      label: copy.label,
      badge: copy.badge,
      description: copy.description,
      participates: copy.participates,
      projections,
      numericStatus,
      hardViolations,
      flags,
      unknownConditions,
      tasks,
      evidenceRefs,
    };
  });
}

/**
 * Conditional ranking: drop verified hard violations, then prefer options without a numeric
 * shortfall, then options that satisfy the student's participation goal, then fewer absences.
 */
export function recommend(options: DecisionOption[], facts: PlanningFacts): Recommendation {
  const totalMisses = (o: DecisionOption) => o.projections.reduce((n, p) => n + p.misses, 0);
  const key = (o: DecisionOption) => [
    o.hardViolations.length > 0 ? 1 : 0,
    o.numericStatus === "NOT_OK_NUMERIC_ONLY" ? 1 : 0,
    o.participates ? 0 : 1,
    totalMisses(o),
  ];
  const ranked = [...options].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  });
  const best = ranked[0];
  const lowest = [...best.projections].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];
  const threshold = facts.policy?.minimumAttendancePercent;
  const reasons: string[] = [];
  if (best.numericStatus === "OK_NUMERIC_ONLY") {
    reasons.push(`Keeps every course at or above the sample ${threshold}% threshold (lowest: ${lowest.name} ${formatPercent(lowest.percent)}).`);
  }
  if (best.participates) reasons.push(`Still joins ${facts.opportunity.name}, matching the stated goal.`);
  for (const o of ranked.slice(1)) {
    if (o.numericStatus === "NOT_OK_NUMERIC_ONLY") {
      const worst = o.projections.find((p) => p.status === "NOT_OK_NUMERIC_ONLY")!;
      reasons.push(`${o.label} projects ${worst.name} at ${formatPercent(worst.percent)}, below the sample threshold.`);
    } else if (!o.participates) {
      const ns = o.projections.find((p) => p.courseId === lowest.courseId);
      reasons.push(`${o.label} is the least disruptive academically (${ns?.name} ${formatPercent(ns?.percent ?? null)}) but does not meet the participation goal.`);
    }
  }
  const conditions = best.unknownConditions.map((u) => `${u.label}: ${u.reason}`);
  return {
    optionId: best.id,
    conditional: best.unknownConditions.length > 0,
    headline: best.unknownConditions.length > 0 ? `${best.label} — conditionally` : best.label,
    reasons,
    conditions,
    ranking: ranked.map((o) => o.id),
  };
}

export function evaluatePlan(facts: PlanningFacts): PlanResult {
  const options = enumerateOptions(facts);
  const recommendation = recommend(options, facts);
  const refs = [
    ...facts.courses.map((c) => c.ref),
    ...(facts.policy ? [facts.policy.ref] : []),
    facts.opportunity.ref,
    facts.assignment.ref,
    facts.assessment.ref,
  ];
  return {
    engineVersion: ENGINE_VERSION,
    computedAt: facts.now,
    facts: {
      assignmentDueAt: facts.assignment.dueAt,
      assessmentStartsAt: facts.assessment.startsAt,
      eventStart: facts.opportunity.start,
      eventEnd: facts.opportunity.end,
      registrationDeadline: facts.opportunity.registrationDeadline,
      policyThreshold: facts.policy?.minimumAttendancePercent ?? null,
      policyIsOfficial: facts.policy?.isOfficial ?? false,
    },
    options,
    recommendation,
    conflicts: findConflicts(facts),
    evidence: refs,
  };
}
