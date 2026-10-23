import type { CourseFacts, EvidenceRef, OptionId, PlanningFacts } from "@/lib/contracts";
import { evaluateThreshold, formatPercent, projectAttendance } from "@/lib/core/attendance";
import { evaluatePlan, findConflicts, registrationStatus } from "@/lib/core/planner";
import { formatIst } from "@/lib/core/time";
import type { RunMemory } from "@/lib/agents/tools";
import type { Intent } from "./intent";

// Findings are computed by the deterministic engine from the evidence the tools returned.
// The model never produces a number that reaches the student unchecked.

export type Findings = { findings: string[]; unknowns: string[]; missing: string[] };

const OPTION_LABEL: Record<OptionId, string> = { full: "Attending the full event", partial: "Attending selected sessions", defer: "Deferring" };

function courseFacts(m: RunMemory): CourseFacts[] | null {
  if (!m.courses || !m.attendance) return null;
  const out: CourseFacts[] = [];
  for (const c of m.courses) {
    const a = m.attendance.find((x) => x.courseId === c.id);
    if (!a) return null;
    out.push({ ...c, attended: a.attended, total: a.total });
  }
  return out;
}

function fullFacts(m: RunMemory, now: string): PlanningFacts | null {
  const courses = courseFacts(m);
  if (!courses || !m.assignment || !m.assessment || m.policy === undefined || !m.opportunity) return null;
  return { now, courses, policy: m.policy, opportunity: m.opportunity, assignment: m.assignment, assessment: m.assessment };
}

function attendance(m: RunMemory): Findings {
  const courses = courseFacts(m);
  if (!courses || m.policy === undefined) return { findings: [], unknowns: [], missing: ["attendance records and the attendance rule"] };
  const project = (c: CourseFacts, o: OptionId) => {
    const p = projectAttendance({ attended: c.attended, total: c.total, futureScheduled: c.futureScheduled, misses: c.missesByOption[o] });
    return { p, status: evaluateThreshold(p, m.policy) };
  };
  const threshold = m.policy?.minimumAttendancePercent;
  const ranked = [...courses].sort((a, b) => {
    const pa = project(a, "full").p;
    const pb = project(b, "full").p;
    return (pa.kind === "value" ? pa.percent : 101) - (pb.kind === "value" ? pb.percent : 101);
  });
  const worst = ranked[0];
  const findings: string[] = [];
  const full = project(worst, "full");
  if (full.p.kind === "value") {
    const below = full.status === "NOT_OK_NUMERIC_ONLY";
    findings.push(
      `${OPTION_LABEL.full} projects ${worst.name} at ${formatPercent(full.p.percent)} (${full.p.numerator}/${full.p.denominator})${
        threshold !== undefined ? (below ? ` — below the sample ${threshold}% threshold.` : ` — at or above the sample ${threshold}% threshold.`) : "."
      }`,
    );
  }
  const others = (["partial", "defer"] as OptionId[])
    .map((o) => {
      const r = project(worst, o);
      return r.p.kind === "value" ? `${OPTION_LABEL[o].toLowerCase()} projects ${formatPercent(r.p.percent)}` : null;
    })
    .filter(Boolean);
  if (others.length) findings.push(`For ${worst.name}, ${others.join("; ")}.`);
  const rest = ranked
    .slice(1)
    .map((c) => {
      const r = project(c, "full");
      return r.p.kind === "value" ? `${c.name} ${formatPercent(r.p.percent)}` : null;
    })
    .filter(Boolean);
  if (rest.length) findings.push(`Other courses under full attendance: ${rest.join(", ")}.`);
  const unknowns = [
    m.policy?.isOfficial ? null : `The ${threshold}% threshold is a sample configuration, not an official regulation.`,
    "Missed-class counts are scenario estimates; no timetable is connected.",
  ].filter((x): x is string => !!x);
  return { findings, unknowns, missing: [] };
}

function conflicts(m: RunMemory, now: string): Findings {
  if (!m.assignment || !m.assessment || !m.opportunity) return { findings: [], unknowns: [], missing: ["deadlines and the event dates"] };
  const facts = { now, courses: [], policy: null, opportunity: m.opportunity, assignment: m.assignment, assessment: m.assessment } satisfies PlanningFacts;
  const list = findConflicts(facts).filter((c) => c.kind !== "REGISTRATION_WINDOW");
  return {
    findings: list.length ? list.map((c) => c.message) : ["No assignment or assessment deadline clashes with the event dates."],
    unknowns: ["Class-level clashes are not checked: no timetable source is connected."],
    missing: [],
  };
}

function verification(m: RunMemory, now: string): Findings {
  if (!m.opportunity) return { findings: [], unknowns: [], missing: ["the event listing"] };
  const reg = registrationStatus(now, m.opportunity.registrationDeadline, m.opportunity.ref.verification === "verified");
  const regText =
    reg.status === "closed"
      ? `Registration closed ${formatIst(reg.deadline!)} per the listing (this assumes you have not registered yet).`
      : reg.status === "unverified"
        ? "No registration deadline is on record."
        : `Registration is open until ${formatIst(reg.deadline!)} per an unverified listing (assumes you have not registered yet).`;
  const unknowns = [
    m.eventRules ? `Event eligibility: ${m.eventRules.eligibility} — ${m.eventRules.reason.toLowerCase()}.` : "Event eligibility: not checked.",
    `On-duty approval: ${m.opportunity.approval.replace(/\.$/, "")}. CampusPilot cannot request or grant it.`,
    m.policy && !m.policy.isOfficial ? `Attendance rule: the ${m.policy.minimumAttendancePercent}% threshold is a sample configuration, not an official regulation.` : null,
  ].filter((x): x is string => !!x);
  return { findings: [regText], unknowns, missing: [] };
}

function tradeoffs(m: RunMemory, now: string, explain: boolean): Findings {
  const facts = fullFacts(m, now);
  if (!facts) return { findings: [], unknowns: [], missing: ["the full set of academic records and event details"] };
  const plan = evaluatePlan(facts);
  if (explain) {
    return {
      findings: [`CampusPilot recommends: ${plan.recommendation.headline}.`, ...plan.recommendation.reasons],
      unknowns: plan.options.find((o) => o.id === plan.recommendation.optionId)!.unknownConditions.map((u) => `${u.label}: ${u.reason}`),
      missing: [],
    };
  }
  const focus = [...plan.options[0].projections].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0].courseId;
  const findings = plan.options.map((o) => {
    const p = o.projections.find((x) => x.courseId === focus)!;
    const blocked = o.hardViolations.length ? ` Not possible: ${o.hardViolations[0]}` : "";
    return `${o.label}: ${p.name} ${formatPercent(p.percent)}, ${o.totalAbsences} class${o.totalAbsences === 1 ? "" : "es"} missed (scenario estimate).${blocked}`;
  });
  return {
    findings,
    unknowns: ["Eligibility and on-duty approval are not verified.", `Recommended (conditionally): ${plan.recommendation.headline.replace(/ — conditionally$/, "")}.`],
    missing: [],
  };
}

export function composeFindings(intent: Intent, memory: RunMemory, now: string): Findings {
  switch (intent) {
    case "attendance_risk":
      return attendance(memory);
    case "deadline_conflicts":
      return conflicts(memory, now);
    case "verification":
      return verification(memory, now);
    case "participation_tradeoffs":
      return tradeoffs(memory, now, false);
    case "explain_recommendation":
      return tradeoffs(memory, now, true);
    default:
      return { findings: [], unknowns: [], missing: [] };
  }
}

export function gatheredSources(m: RunMemory): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  m.courses?.forEach((c) => refs.push(c.ref));
  if (m.policy) refs.push(m.policy.ref);
  if (m.assignment) refs.push(m.assignment.ref);
  if (m.assessment) refs.push(m.assessment.ref);
  if (m.opportunity) refs.push(m.opportunity.ref);
  return refs;
}

// ── Model summary validation ─────────────────────────────────────────────────

export const SUMMARY_SCHEMA = { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } as const;
export const SUMMARY_PROMPT =
  "Rewrite the verified findings for the student in at most two short sentences. Use only facts from the findings. Do not add numbers, dates or advice that are not in the findings. JSON only.";

const NUMBER = /\d+(?:[.:/]\d+)?%?/g;

/**
 * Accept a model-written summary only if it is short and every number in it appears, with the
 * same form (a percentage stays a percentage, a ratio stays a ratio), in the deterministic
 * findings. Otherwise the student sees the findings alone. Observed on the presentation Mac:
 * llama3.2:1b turned "74.2% (23/31) … 75% threshold" into "23% below 75% threshold"; this check
 * rejects that. Prose meaning is not verified, which is why summaries are off by default.
 */
export function validateSummary(content: string, findings: string[]): { ok: true; text: string } | { ok: false; reason: string } {
  let summary: unknown;
  try {
    summary = (JSON.parse(content) as { summary?: unknown }).summary;
  } catch {
    return { ok: false, reason: "not valid JSON" };
  }
  if (typeof summary !== "string" || summary.trim().length < 10) return { ok: false, reason: "empty summary" };
  const text = summary.trim().replace(/\s+/g, " ");
  if (text.length > 400) return { ok: false, reason: "summary too long" };
  const allowed = new Set(findings.join(" ").match(NUMBER) ?? []);
  const unverified = (text.match(NUMBER) ?? []).filter((n) => !allowed.has(n));
  if (unverified.length) return { ok: false, reason: `contained numbers not in the findings (${unverified.slice(0, 3).join(", ")})` };
  return { ok: true, text };
}
