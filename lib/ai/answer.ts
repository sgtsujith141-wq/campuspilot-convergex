import type { CourseFacts, EvidenceRef, OptionId, PlanningFacts, TimeBlock } from "@/lib/contracts";
import { evaluateThreshold, formatPercent, projectAttendance } from "@/lib/core/attendance";
import { evaluatePlan, findConflicts, latestEveningBlock, PROJECT_BUFFER_HOURS, registrationStatus } from "@/lib/core/planner";
import { formatBlock, formatIst, formatIstTime, formatIstWeekday, toMs } from "@/lib/core/time";
import { attendanceWindow, overlappingSessions, type ClassSession } from "@/lib/core/timetable";
import type { RunMemory } from "@/lib/agents/tools";
import type { Intent } from "./intent";

// Findings are computed by the deterministic engine from the evidence the tools returned.
// The model never produces a number that reaches the student unchecked.

export type AnswerItem = { title: string; tag?: string; tone?: "bad" | "warn" | "ok" | "neutral"; detail: string };
export type AnswerClash = { optionId: OptionId; label: string; window: string; sessions: { id: string; course: string; type: string; when: string; room: string }[] };
export type AnswerAction = "timetable" | "compare" | "plan";
/** Student-facing answer, composed deterministically from the evidence the tools returned. */
export type AnswerDoc = { headline: string; items: AnswerItem[]; nextStep: string | null; clashes: AnswerClash[]; verify: string[]; actions: AnswerAction[] };

export type Findings = { findings: string[]; unknowns: string[]; missing: string[]; answer?: AnswerDoc | null };

const HOUR = 3600 * 1000;
const COUNT = ["no", "one", "two", "three", "four", "five", "six"];
const count = (n: number) => COUNT[n] ?? String(n);
const sessionWhen = (c: ClassSession) => `${formatIstWeekday(c.start)} · ${formatIstTime(c.start)}–${formatIstTime(c.end)}`;
const windowText = (w: { start: string; end: string }) =>
  formatIstWeekday(w.start) === formatIstWeekday(w.end) ? `${formatIstWeekday(w.start)}, ${formatIstTime(w.start)}–${formatIstTime(w.end)}` : `${formatIst(w.start)} – ${formatIst(w.end)}`;

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
    "Missed-class counts match the synthetic sample timetable, not a verified one.",
  ].filter((x): x is string => !!x);
  const items: AnswerItem[] = (["full", "partial", "defer"] as OptionId[]).map((o) => {
    const r = project(worst, o);
    const below = r.status === "NOT_OK_NUMERIC_ONLY";
    return {
      title: { full: "Attend full event", partial: "Attend selected sessions", defer: "Defer participation" }[o],
      tag: below ? "Below sample threshold" : r.status === "OK_NUMERIC_ONLY" ? "Meets sample threshold" : undefined,
      tone: below ? "bad" : "ok",
      detail: r.p.kind === "value" ? `${worst.name} ${formatPercent(r.p.percent)} (${r.p.numerator}/${r.p.denominator}), ${worst.missesByOption[o]} class${worst.missesByOption[o] === 1 ? "" : "es"} missed.` : "Not computable.",
    };
  });
  const partialOk = project(worst, "partial").status === "OK_NUMERIC_ONLY";
  return {
    findings,
    unknowns,
    missing: [],
    answer: {
      headline: `${worst.name} is your biggest attendance risk.`,
      items,
      nextStep: partialOk
        ? "Selected sessions keep this course above the sample threshold. Compare the options before deciding — the threshold is an example, not an official rule."
        : "Compare the options before deciding — the threshold is an example, not an official rule.",
      clashes: [],
      verify: unknowns,
      actions: ["compare", "timetable", "plan"],
    },
  };
}

function conflicts(m: RunMemory, now: string): Findings {
  if (!m.assignment || !m.assessment || !m.opportunity) return { findings: [], unknowns: [], missing: ["deadlines and the event dates"] };
  const facts = { now, courses: [], policy: null, opportunity: m.opportunity, assignment: m.assignment, assessment: m.assessment } satisfies PlanningFacts;
  const list = findConflicts(facts).filter((c) => c.kind !== "REGISTRATION_WINDOW");
  const { assignment: a, assessment: s, opportunity: o } = m;
  const due = toMs(a.dueAt);
  const ev = { start: toMs(o.start), end: toMs(o.end) };
  const items: AnswerItem[] = [];
  const projectBlock: TimeBlock | null = latestEveningBlock(Math.min(due, ev.start) - PROJECT_BUFFER_HOURS * HOUR, toMs(now), 3, [ev]);
  if (due < toMs(now)) items.push({ title: a.name, tag: "Overdue", tone: "bad", detail: `Was due ${formatIst(a.dueAt)}.` });
  else if (due >= ev.start && due <= ev.end)
    items.push({ title: a.name, tag: "Urgent", tone: "bad", detail: `Due ${formatIst(a.dueAt)}, while ${o.name} is underway. Finish it before the event${projectBlock ? `; the planner suggests a work block on ${formatBlock(projectBlock)}` : ""}.` });
  else if (due < ev.start)
    items.push({ title: a.name, tag: "Due before the event", tone: "warn", detail: `Due ${formatIst(a.dueAt)}, before ${o.name} starts${projectBlock ? `; the planner suggests a work block on ${formatBlock(projectBlock)}` : ""}.` });
  const gap = Math.round((toMs(s.startsAt) - ev.end) / HOUR);
  if (gap >= 0 && gap < 72) {
    const avoid = [ev, ...(projectBlock ? [{ start: toMs(projectBlock.start), end: toMs(projectBlock.end) }] : [])];
    const prep = latestEveningBlock(toMs(s.startsAt), toMs(now), s.studyHoursDesired, avoid);
    items.push({
      title: s.name,
      tag: "Preparation needed",
      tone: "warn",
      detail: `Begins ${formatIst(s.startsAt)}, just ${gap} hours after the event ends. Protect the ${s.studyHoursDesired}-hour preparation block${prep ? ` (${formatBlock(prep)} suggested)` : ""}, subject to your timetable.`,
    });
  }
  return {
    findings: list.length ? list.map((c) => c.message) : ["No assignment or assessment deadline clashes with the event dates."],
    unknowns: ["Class clashes are in the sample timetable — ask which classes clash."],
    missing: [],
    answer: {
      headline: items.length ? `You have ${count(items.length)} academic commitment${items.length === 1 ? "" : "s"} to plan around.` : "No deadline clashes with the event.",
      items,
      nextStep:
        "Review the selected-session plan. Full participation also affects your sample attendance projection. CampusPilot can prepare local tasks, but event eligibility and institutional permission remain unverified.",
      clashes: [],
      verify: ["Suggested work blocks are proposals, not checked against your other commitments.", "Event eligibility and on-duty approval are unverified."],
      actions: ["timetable", "compare", "plan"],
    },
  };
}

function classClashes(m: RunMemory): Findings {
  if (!m.timetable || !m.opportunity) return { findings: [], unknowns: [], missing: ["the class timetable and the event dates"] };
  const event = { start: m.opportunity.start, end: m.opportunity.end };
  const partial = m.timetable.partialWindow;
  const opts: { id: OptionId; label: string }[] = [
    { id: "full", label: "Attend full event" },
    { id: "partial", label: "Attend selected sessions" },
    { id: "defer", label: "Defer participation" },
  ];
  const clashes: AnswerClash[] = opts.map((o) => {
    const w = attendanceWindow(o.id, event, partial);
    return {
      optionId: o.id,
      label: o.label,
      window: w ? windowText(w) : "No event time",
      sessions: overlappingSessions(m.timetable!.sessions, w).map((c) => ({ id: c.id, course: `${c.name} (${c.code})`, type: c.type, when: sessionWhen(c), room: c.room })),
    };
  });
  const full = overlappingSessions(m.timetable.sessions, event);
  const part = overlappingSessions(m.timetable.sessions, partial);
  const byCourse = new Map<string, ClassSession[]>();
  for (const c of full) byCourse.set(c.courseId, [...(byCourse.get(c.courseId) ?? []), c]);
  const items: AnswerItem[] = [...byCourse.values()].map((list) => {
    const inPartial = list.filter((c) => part.some((p) => p.id === c.id)).length;
    return {
      title: `${list[0].name} (${list[0].code})`,
      tag: `${list.length} class${list.length === 1 ? "" : "es"} in the full event`,
      tone: inPartial ? "bad" : "warn",
      detail: `${list.map((c) => `${c.type} ${sessionWhen(c)}, ${c.room}`).join("; ")}. ${inPartial ? `Selected sessions still miss ${inPartial} of these.` : "Selected sessions avoid these."}`,
    };
  });
  const describe = (list: ClassSession[]) => list.map((c) => `${c.name} ${c.type.toLowerCase()} (${sessionWhen(c)})`).join(", ");
  return {
    findings: [
      `Full event (${windowText(event)}): clashes with ${full.length} class${full.length === 1 ? "" : "es"}${full.length ? ` — ${describe(full)}` : ""}.`,
      `Selected sessions (${windowText(partial)}): clashes with ${part.length} class${part.length === 1 ? "" : "es"}${part.length ? ` — ${describe(part)}` : ""}.`,
      "Defer: no class clashes from the event.",
    ],
    unknowns: ["The timetable is a synthetic sample; class times are not institutionally verified.", "Event session times come from an unverified listing."],
    missing: [],
    answer: {
      headline: `Attending the full event clashes with ${count(full.length)} class${full.length === 1 ? "" : "es"}; selected sessions clash with ${count(part.length)}.`,
      items,
      nextStep:
        part.length < full.length
          ? `Selected sessions (${windowText(partial)}) miss only ${describe(part) || "no classes"}. Compare the options to see the attendance impact, and confirm the session times with the organisers.`
          : "Compare the options to see the attendance impact before deciding.",
      clashes,
      verify: ["Sample timetable — not VTOP and not institutionally verified.", "Event session times and on-duty approval are unverified."],
      actions: ["timetable", "compare", "plan"],
    },
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
  const items: AnswerItem[] = [
    { title: "Event eligibility", tag: m.eventRules ? m.eventRules.eligibility : "not checked", tone: "bad", detail: m.eventRules ? `No official event rules have been supplied (${m.eventRules.verification}).` : "Not checked." },
    { title: "On-duty approval", tag: "Needed", tone: "warn", detail: `${m.opportunity.approval.replace(/\.$/, "")}. Only your institution can grant it.` },
    { title: "Registration", tag: reg.status === "closed" ? "Closed" : reg.status === "unverified" ? "Unknown" : "Open", tone: reg.status === "closed" ? "bad" : "neutral", detail: regText },
    ...(m.policy && !m.policy.isOfficial ? [{ title: "Attendance rule", tag: "Sample", tone: "neutral" as const, detail: `The ${m.policy.minimumAttendancePercent}% threshold is a sample configuration, not an official regulation.` }] : []),
  ];
  return {
    findings: [regText],
    unknowns,
    missing: [],
    answer: {
      headline: "Confirm these before you participate.",
      items,
      nextStep: `Confirm eligibility and on-duty approval with the organisers and your institution${reg.status === "open" || reg.status === "closing_soon" ? ` before registration closes ${formatIst(reg.deadline!)}` : ""}. CampusPilot can add this as a task in your plan, but cannot request or grant either.`,
      clashes: [],
      verify: [],
      actions: ["plan", "compare"],
    },
  };
}

function tradeoffs(m: RunMemory, now: string, explain: boolean): Findings {
  const facts = fullFacts(m, now);
  if (!facts) return { findings: [], unknowns: [], missing: ["the full set of academic records and event details"] };
  const plan = evaluatePlan(facts);
  if (explain) {
    const unknowns = plan.options.find((o) => o.id === plan.recommendation.optionId)!.unknownConditions.map((u) => `${u.label}: ${u.reason}`);
    return {
      findings: [`CampusPilot recommends: ${plan.recommendation.headline}.`, ...plan.recommendation.reasons],
      unknowns,
      missing: [],
      answer: {
        headline: `CampusPilot recommends: ${plan.recommendation.headline}.`,
        items: plan.recommendation.reasons.map((r, i) => ({ title: `Reason ${i + 1}`, detail: r })),
        nextStep: "Compare the options, then approve the plan you choose. Approval only creates local tasks.",
        clashes: [],
        verify: unknowns.slice(0, 3),
        actions: ["compare", "plan"],
      },
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
    answer: {
      headline: `Recommended (conditionally): ${plan.recommendation.headline.replace(/ — conditionally$/, "")}.`,
      items: plan.options.map((o, i) => ({ title: o.label, tone: o.numericStatus === "NOT_OK_NUMERIC_ONLY" || o.hardViolations.length ? "bad" : "ok", detail: findings[i].replace(`${o.label}: `, "") })),
      nextStep: "Compare the options in detail, then approve the plan you choose.",
      clashes: [],
      verify: ["Eligibility and on-duty approval are not verified."],
      actions: ["compare", "plan", "timetable"],
    },
  };
}

export function composeFindings(intent: Intent, memory: RunMemory, now: string): Findings {
  switch (intent) {
    case "attendance_risk":
      return attendance(memory);
    case "deadline_conflicts":
      return conflicts(memory, now);
    case "class_clashes":
      return classClashes(memory);
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
  if (m.timetable) refs.push(m.timetable.ref);
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
