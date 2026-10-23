// Shared type contracts between the deterministic engine, the server and the UI.
// Mirrors specs/03_ENGINEERING_AND_SECURITY.md ("Core model contracts").

export type SourceKind =
  | "academic_simulator"
  | "student_import"
  | "official_event"
  | "curated_example"
  | "manual"
  | "sample_policy";
export type Verification = "verified" | "unverified" | "synthetic" | "stale";

export type EvidenceRef = {
  id: string;
  source: SourceKind;
  retrievedAt: string;
  verification: Verification;
  recordVersion: number;
  label: string;
};

export type OptionId = "full" | "partial" | "defer";
export const OPTION_IDS: readonly OptionId[] = ["full", "partial", "defer"] as const;

export type NumericStatus = "OK_NUMERIC_ONLY" | "NOT_OK_NUMERIC_ONLY" | "NEEDS_VERIFICATION";

export type CourseFacts = {
  id: string;
  code: string;
  name: string;
  attended: number;
  total: number;
  futureScheduled: number;
  missesByOption: Record<OptionId, number>;
  ref: EvidenceRef;
};

export type PolicyFacts = {
  id: string;
  isOfficial: boolean;
  minimumAttendancePercent: number;
  appliesTo: string;
  notes: string;
  ref: EvidenceRef;
};

export type OpportunityFacts = {
  id: string;
  name: string;
  fictional: boolean;
  start: string;
  end: string;
  registrationDeadline: string;
  eligibility: string;
  approval: string;
  /** Untrusted free text. Never interpreted as instructions. */
  description?: string;
  ref: EvidenceRef;
};

export type AssignmentFacts = {
  id: string;
  courseId: string;
  name: string;
  dueAt: string;
  ref: EvidenceRef;
};

export type AssessmentFacts = {
  id: string;
  courseId: string;
  name: string;
  startsAt: string;
  studyHoursDesired: number;
  ref: EvidenceRef;
};

export type PlanningFacts = {
  now: string;
  courses: CourseFacts[];
  policy: PolicyFacts | null;
  opportunity: OpportunityFacts;
  assignment: AssignmentFacts;
  assessment: AssessmentFacts;
};

export type CourseProjection = {
  courseId: string;
  code: string;
  name: string;
  attended: number;
  total: number;
  futureScheduled: number;
  misses: number;
  projectedAttended: number;
  projectedTotal: number;
  /** null when the denominator is zero (UNKNOWN, never NaN). */
  percent: number | null;
  status: NumericStatus;
  evidenceRef: string;
};

export type UnknownCondition = {
  id: "event_eligibility" | "od_approval" | "attendance_regulation" | "timetable" | "source_freshness";
  label: string;
  status: "NEEDS_VERIFICATION";
  reason: string;
  evidenceRef?: string;
};

export type Conflict = {
  id: string;
  kind: "DEADLINE_DURING_EVENT" | "DEADLINE_BEFORE_EVENT" | "DEADLINE_PASSED" | "PREP_AFTER_EVENT" | "REGISTRATION_WINDOW";
  severity: "hard" | "soft" | "info";
  message: string;
  evidenceRefs: string[];
};

export type TimeBlock = { start: string; end: string };

/** Registration state relative to the scenario clock. "unverified" = no deadline on record. */
export type RegistrationStatus = "open" | "closing_soon" | "closed" | "unverified";
export type RegistrationFacts = {
  status: RegistrationStatus;
  deadline: string | null;
  /** Whole hours until the deadline (negative once closed); null when unverified. */
  hoursRemaining: number | null;
  /** Whether the listing itself comes from a verified official source. */
  sourceVerified: boolean;
};

export type TaskDraft = {
  taskKey: string;
  type: "create_local_task";
  title: string;
  detail: string;
  dueAt?: string;
  block?: TimeBlock;
  evidenceRefs: string[];
};

export type DecisionOption = {
  id: OptionId;
  label: string;
  badge: string;
  description: string;
  /** Data-derived absence estimate, e.g. "Scenario estimate: 2 Network Security classes, 1 Database Systems class". */
  absenceSummary: string;
  totalAbsences: number;
  participates: boolean;
  projections: CourseProjection[];
  /** Status of the most constrained course under the configured policy. */
  numericStatus: NumericStatus;
  /** Only violations of *verified* hard constraints. Sample-policy shortfalls are flags, not violations. */
  hardViolations: string[];
  flags: string[];
  unknownConditions: UnknownCondition[];
  tasks: TaskDraft[];
  evidenceRefs: string[];
};

export type Recommendation = {
  optionId: OptionId;
  conditional: boolean;
  headline: string;
  reasons: string[];
  conditions: string[];
  ranking: OptionId[];
};

export type PlanResult = {
  engineVersion: string;
  computedAt: string;
  facts: {
    assignmentDueAt: string;
    assessmentStartsAt: string;
    eventStart: string;
    eventEnd: string;
    registrationDeadline: string;
    policyThreshold: number | null;
    policyIsOfficial: boolean;
    registration: RegistrationFacts;
  };
  /** Evidence older than the freshness window relative to the scenario clock. */
  freshness: { maxAgeHours: number; stale: string[] };
  options: DecisionOption[];
  recommendation: Recommendation;
  conflicts: Conflict[];
  evidence: EvidenceRef[];
};

export type TaskChange = {
  optionId: OptionId;
  taskKey: string;
  change: "added" | "removed" | "changed";
  before?: Pick<TaskDraft, "title" | "detail" | "dueAt" | "block">;
  after?: Pick<TaskDraft, "title" | "detail" | "dueAt" | "block">;
};

export type FactChange = { field: string; label: string; before: string | number | null; after: string | number | null };

export type RevisionDiff = {
  fromRevision: number;
  toRevision: number;
  facts: FactChange[];
  tasks: TaskChange[];
  recommendationChanged: boolean;
  projectionChanges: { optionId: OptionId; courseId: string; before: number | null; after: number | null }[];
  changed: boolean;
};

export type TraceMode = "live_llm" | "deterministic";
