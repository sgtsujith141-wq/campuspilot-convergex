// Pure presentation helpers shared by the UI. Everything here is derived from the workspace
// snapshot so the screens never hard-code counts, dates or scenario-specific labels.
import type { OptionId, RegistrationFacts } from "./contracts";
import { registrationStatus } from "./core/planner";
import { formatBlock, formatDateRange, formatIst, istDayKey, toMs } from "./core/time";
import type { MissionView, TraceEventView, WorkspaceSnapshot } from "./views";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "bad";

export const OPTION_LABEL: Record<OptionId, string> = {
  full: "Attend full event",
  partial: "Attend selected sessions",
  defer: "Defer participation",
};

export function courseInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  return (words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

export type MissionState = "none" | "awaiting" | "approved" | "needs_review";

export function missionState(mission: MissionView | null): MissionState {
  if (!mission) return "none";
  if (mission.approval && mission.approval.revision === mission.revision) return "approved";
  if (mission.lastInvalidated) return "needs_review";
  return "awaiting";
}

export function registrationFor(ws: WorkspaceSnapshot): RegistrationFacts {
  return registrationStatus(ws.scenario.asOf, ws.opportunity.registrationDeadline, ws.opportunity.verification === "verified");
}

export function registrationText(reg: RegistrationFacts): { label: string; tone: Tone } {
  if (reg.status === "closed") return { label: `Closed ${formatIst(reg.deadline!)}`, tone: "bad" };
  if (reg.status === "closing_soon") return { label: `Closes ${formatIst(reg.deadline!)} · ${reg.hoursRemaining} h left`, tone: "warn" };
  if (reg.status === "open") return { label: `Open until ${formatIst(reg.deadline!)}`, tone: "neutral" };
  return { label: "No deadline on record", tone: "warn" };
}

export function assignmentMoved(ws: WorkspaceSnapshot) {
  return ws.assignment.dueAt !== ws.assignment.originalDueAt;
}

export function dueDuringEvent(ws: WorkspaceSnapshot) {
  const due = toMs(ws.assignment.dueAt);
  return due >= toMs(ws.opportunity.start) && due <= toMs(ws.opportunity.end);
}

export type AttentionItem = { id: string; tone: Tone; title: string; detail: string; href: string };

export function attentionItems(ws: WorkspaceSnapshot): AttentionItem[] {
  const items: AttentionItem[] = [];
  const m = ws.mission;
  const state = missionState(m);
  if (m && state === "needs_review") {
    items.push({
      id: "replan",
      tone: "warn",
      title: "Your revised plan needs approval",
      detail: `Revision ${m.revision} replaced revision ${m.lastInvalidated!.revision} after a source change.`,
      href: "/decisions#plan-update",
    });
  } else if (m && state === "awaiting") {
    items.push({ id: "review", tone: "accent", title: "A recommendation is ready to review", detail: m.result.recommendation.headline, href: "/decisions" });
  }

  const reg = registrationFor(ws);
  if (reg.status === "closed") {
    items.push({ id: "registration", tone: "bad", title: `Registration for ${ws.opportunity.name} has closed`, detail: `Closed ${formatIst(reg.deadline!)} per the listing.`, href: "/decisions" });
  } else if (reg.status === "closing_soon") {
    items.push({ id: "registration", tone: "warn", title: `Registration closes in ${reg.hoursRemaining} hours`, detail: `${ws.opportunity.name} · ${formatIst(reg.deadline!)}`, href: "/decisions" });
  } else if (reg.status === "open" && (reg.hoursRemaining ?? Infinity) <= 7 * 24) {
    items.push({
      id: "registration",
      tone: "neutral",
      title: `Registration closes ${formatIst(reg.deadline!)}`,
      detail: `${ws.opportunity.name} · ${Math.floor((reg.hoursRemaining ?? 0) / 24)} days left · listing not verified`,
      href: "/decisions",
    });
  }

  if (assignmentMoved(ws)) {
    items.push({
      id: "deadline",
      tone: "warn",
      title: `${ws.assignment.name} is now due earlier`,
      detail: `${formatIst(ws.assignment.dueAt)} (was ${formatIst(ws.assignment.originalDueAt)})`,
      href: "/decisions#plan-update",
    });
  } else if (dueDuringEvent(ws)) {
    items.push({ id: "deadline", tone: "warn", title: `${ws.assignment.name} is due during the event`, detail: `Due ${formatIst(ws.assignment.dueAt)}`, href: "/decisions" });
  }

  const threshold = ws.policy?.threshold;
  if (threshold !== undefined) {
    const lowest = [...ws.courses].filter((c) => c.currentPercent !== null).sort((a, b) => (a.currentPercent ?? 0) - (b.currentPercent ?? 0))[0];
    if (lowest && lowest.currentPercent !== null && lowest.currentPercent < threshold + 5) {
      const gap = lowest.currentPercent - threshold;
      items.push({
        id: "attendance",
        tone: gap < 0 ? "bad" : "neutral",
        title: gap < 0 ? `${lowest.name} is below the sample threshold` : `${lowest.name} is ${gap.toFixed(1)} points above the sample threshold`,
        detail: `${lowest.attended} of ${lowest.total} classes · sample ${threshold}% rule, not an official regulation`,
        href: "/decisions",
      });
    }
  }

  if (m && state === "approved" && m.result.options.find((o) => o.id === m.approval?.optionId)?.participates) {
    items.push({ id: "od", tone: "neutral", title: "On-duty approval is not verified", detail: "Your plan is approved in CampusPilot only. The institution has not approved anything.", href: "/decisions" });
  }
  return items;
}

export type TimelineEntry = { id: string; at: string; title: string; detail: string; kind: "registration" | "event" | "assignment" | "assessment" | "work"; tone: Tone; changed?: boolean };

export function timelineEntries(ws: WorkspaceSnapshot): TimelineEntry[] {
  const moved = assignmentMoved(ws);
  const entries: TimelineEntry[] = [
    { id: "reg", at: ws.opportunity.registrationDeadline, title: `${ws.opportunity.name} registration closes`, detail: "Opportunity", kind: "registration", tone: "neutral" },
    { id: "event", at: ws.opportunity.start, title: ws.opportunity.name, detail: `Event · ${formatDateRange(ws.opportunity.start, ws.opportunity.end)}`, kind: "event", tone: "accent" },
    {
      id: "assignment",
      at: ws.assignment.dueAt,
      title: ws.assignment.name,
      detail: moved ? `Assignment due · moved from ${formatIst(ws.assignment.originalDueAt)}` : "Assignment due",
      kind: "assignment",
      tone: moved ? "warn" : "neutral",
      changed: moved,
    },
    { id: "assessment", at: ws.assessment.startsAt, title: ws.assessment.name, detail: "Assessment", kind: "assessment", tone: "neutral" },
  ];
  for (const t of ws.tasks) {
    if (t.status === "superseded" || !t.blockStart || !t.blockEnd) continue;
    entries.push({
      id: `task-${t.id}`,
      at: t.blockStart,
      title: t.title,
      detail: `Planned work · ${formatBlock({ start: t.blockStart, end: t.blockEnd })}${t.status === "needs_review" ? " · needs review" : ""}`,
      kind: "work",
      tone: t.status === "needs_review" ? "warn" : "ok",
    });
  }
  return entries.sort((a, b) => toMs(a.at) - toMs(b.at));
}

export function groupByDay(entries: TimelineEntry[]): { day: string; at: string; entries: TimelineEntry[] }[] {
  const groups = new Map<string, { day: string; at: string; entries: TimelineEntry[] }>();
  for (const e of entries) {
    const key = istDayKey(e.at);
    if (!groups.has(key)) groups.set(key, { day: key, at: e.at, entries: [] });
    groups.get(key)!.entries.push(e);
  }
  return [...groups.values()];
}

export function timelineRange(entries: TimelineEntry[]): string | null {
  if (entries.length === 0) return null;
  return formatDateRange(entries[0].at, entries[entries.length - 1].at);
}

export function summaryLine(ws: WorkspaceSnapshot): string {
  const attention = attentionItems(ws).length;
  const open = ws.mission && missionState(ws.mission) !== "approved" ? 1 : 0;
  const parts = [`${ws.courses.length} course${ws.courses.length === 1 ? "" : "s"} tracked`];
  parts.push(open ? "1 decision open" : ws.mission ? "plan approved" : "1 decision to evaluate");
  parts.push(attention === 0 ? "nothing needs attention" : `${attention} item${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} attention`);
  return parts.join(" · ");
}

// ── Activity: human-readable labels for recorded trace events ───────────────

const TOOL_LABEL: Record<string, string> = {
  get_my_courses: "Read course records",
  get_my_attendance: "Read attendance counts",
  get_my_commitments: "Read assignments and assessments",
  get_applicable_policy: "Checked the attendance policy",
  get_event: "Retrieved opportunity details",
  verify_event_rules: "Checked event eligibility rules",
  calculate_conflicts: "Checked deadline conflicts",
  enumerate_options: "Compared participation options",
  propose_task_drafts: "Prepared the action plan",
};

export function stepLabel(e: TraceEventView): string {
  if (e.tool === "calculate_attendance") {
    const id = (e.args?.optionId as OptionId | undefined) ?? "partial";
    return `Calculated attendance · ${OPTION_LABEL[id] ?? id}`;
  }
  if (e.tool) return TOOL_LABEL[e.tool] ?? e.tool;
  if (e.actor === "Source watcher") return e.summary.startsWith("SOURCE_UPDATED") ? "Detected a source update" : "Identified the affected plan";
  if (e.actor === "Approval gateway") return e.summary.startsWith("Invalidated") ? "Invalidated the outdated approval" : "Checked existing approvals";
  if (e.actor === "Permission checkpoint") return "Requested your approval";
  if (e.actor === "Personal orchestrator") return "Started the guided workflow";
  if (e.actor === "Local AI coordinator") {
    if (e.status !== "succeeded") return e.args?.purpose === "summary" ? "Model summary not shown" : "Local model output not used";
    return e.args?.purpose === "summary" ? "Local model wrote a summary" : "Local model interpreted the question";
  }
  if (e.actor === "Scope check") return e.summary.startsWith("Question refused") ? "Refused: out of scope" : "Checked the question is in scope";
  if (e.actor === "Fallback router") return "Keyword fallback chose the route";
  if (e.actor === "Tool gateway") return "Refused a tool request";
  return e.actor;
}

export const RUN_KIND_LABEL = { evaluate: "Evaluated the decision", replan: "Re-planned after a source change", recalculate: "Re-ran the evaluation", ask: "Answered a question" } as const;
