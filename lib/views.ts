// View models returned by the API to the UI (type-only module, safe for client import).
import type { OptionId, PlanResult, RevisionDiff, TaskDraft, TraceMode } from "./contracts";

export type DraftView = Pick<TaskDraft, "taskKey" | "title" | "detail" | "dueAt" | "block" | "evidenceRefs"> & { id: string; status: string };

export type MissionView = {
  id: string;
  goal: string;
  missionType: "event_participation";
  opportunityId: string;
  revision: number;
  status: "needs_approval" | "approved";
  createdAt: string;
  updatedAt: string;
  result: PlanResult;
  drafts: Record<OptionId, DraftView[]>;
  /** Per-revision consent nonce; only ever returned to the mission owner. */
  challenge: string;
  approval: { id: string; revision: number; optionId: OptionId; createdAt: string } | null;
  lastInvalidated: { revision: number; optionId: OptionId; invalidatedAt: string; reason: string } | null;
  diff: RevisionDiff | null;
  revisions: { revision: number; trigger: string; createdAt: string; runId: string; changed: boolean }[];
  sourceVersions: Record<string, number>;
};

export type TaskView = {
  id: string;
  taskKey: string;
  title: string;
  detail: string;
  dueAt: string | null;
  blockStart: string | null;
  blockEnd: string | null;
  originRevision: number;
  status: "active" | "needs_review" | "superseded";
  createdAt: string;
  updatedAt: string;
};

export type TraceEventView = {
  seq: number;
  actor: string;
  tool: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  status: string;
  mode: TraceMode;
  summary: string;
  args: Record<string, unknown> | null;
  evidenceRefs: string[];
  error: string | null;
  requestedBy: "model" | "server" | "workflow" | null;
};

export type RunView = {
  id: string;
  kind: "evaluate" | "replan" | "recalculate" | "ask";
  mode: TraceMode;
  model: string | null;
  revision: number;
  startedAt: string;
  completedAt: string | null;
  status: string;
  summary: string;
  events: TraceEventView[];
};

export type SourceView = {
  id: string;
  label: string;
  kind: string;
  recordType: string;
  verification: string;
  version: number;
  retrievedAt: string;
  shared: boolean;
};

export type WorkspaceSnapshot = {
  student: { name: string; campus: string; fictional: boolean; interests: string[] };
  scenario: { asOf: string; timezone: string; version: string; synthetic: boolean };
  sources: SourceView[];
  courses: { id: string; code: string; name: string; attended: number; total: number; futureScheduled: number; currentPercent: number | null; version: number }[];
  assignment: { id: string; name: string; dueAt: string; version: number; originalDueAt: string; demoDueAt: string; updatedAt: string };
  assessment: { id: string; name: string; startsAt: string; studyHoursDesired: number };
  opportunity: OpportunityView;
  /** Curated catalogue the guided mission can be run against. */
  opportunities: OpportunityView[];
  session: { kind: "sample_login"; expiresAt: string | null };
  /** Synthetic class timetable (sample records, not VTOP). */
  timetable: {
    sourceId: string;
    label: string;
    version: number;
    verification: string;
    partialWindow: { start: string; end: string; note: string };
    sessions: { id: string; courseId: string; code: string; name: string; type: "Lecture" | "Lab"; start: string; end: string; room: string; instructor: string }[];
  } | null;
  policy: { threshold: number; isOfficial: boolean; appliesTo: string; notes: string } | null;
  mission: MissionView | null;
  tasks: TaskView[];
  runs: RunView[];
  notifications: { id: string; at: string; title: string; detail: string }[];
  audit: { at: string; action: string; target: string | null; outcome: string }[];
  demoMode: boolean;
  agent: { mode: TraceMode; label: string; liveModel: null; tools: { name: string; role: string; description: string }[] };
};

export type OpportunityView = {
  id: string;
  name: string;
  start: string;
  end: string;
  registrationDeadline: string;
  eligibility: string;
  approval: string;
  fictional: boolean;
  verification: string;
};

export type ApiErrorBody = { error: string; message: string };

// ── Local AI ─────────────────────────────────────────────────────────────────

export type AiStatusView = {
  status: "local_model_ready" | "local_model_unavailable" | "local_model_error";
  provider: "ollama";
  model: string;
  details?: { parameterSize?: string; quantization?: string; family?: string };
  message?: string;
  checkedAt: string;
};

export type AskToolView = { name: string; requestedBy: "model" | "server"; status: string; evidenceRefs: string[] };

export type AskView = {
  runId: string;
  status: "answered" | "unsupported";
  /** local_llm only when a real local-model call produced the routing decision. */
  mode: TraceMode;
  modelStatus: "local_model_ready" | "local_model_unavailable" | "local_model_error" | "deterministic_fallback";
  model: string | null;
  question: string;
  intent: string;
  intentLabel: string;
  routing: { source: "model" | "fallback" | "scope_check"; modelTools: string[]; serverTools: string[]; attempts: number; modelMs: number | null; rejected: string[] };
  tools: AskToolView[];
  findings: string[];
  unknowns: string[];
  /** Student-facing answer composed deterministically from the returned evidence. */
  answer: {
    headline: string;
    items: { title: string; tag?: string; tone?: "bad" | "warn" | "ok" | "neutral"; detail: string }[];
    nextStep: string | null;
    clashes: { optionId: "full" | "partial" | "defer"; label: string; window: string; sessions: { id: string; course: string; type: string; when: string; room: string }[] }[];
    verify: string[];
    actions: ("timetable" | "compare" | "plan")[];
  } | null;
  summary: { text: string; accepted: true } | { text: null; accepted: false; reason: string } | null;
  sources: { id: string; label: string; version: number; verification: string }[];
  notes: string[];
  stale: boolean;
  durationMs: number;
};
