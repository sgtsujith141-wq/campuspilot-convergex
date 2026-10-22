import { z } from "zod";
import raw from "@/CampusPilot_Build_Kit/data/demo-scenario.json";
import type { EvidenceRef, PlanningFacts } from "@/lib/contracts";

// The supplied seed is imported directly from the kit (never copied) and validated at load,
// so the demo numbers cannot silently drift from data/demo-scenario.json.

const iso = z.string().regex(/T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/, "ISO timestamp with offset");
const misses = z.object({ full: z.number().int().min(0), partial: z.number().int().min(0), defer: z.number().int().min(0) });

export const ScenarioSchema = z.object({
  scenarioVersion: z.string(),
  synthetic: z.literal(true),
  dataAsOf: iso,
  timezone: z.literal("Asia/Kolkata"),
  student: z.object({
    id: z.string(),
    name: z.string(),
    fictional: z.literal(true),
    campus: z.string(),
    interests: z.array(z.string()),
    goals: z.array(z.string()),
  }),
  policy: z.object({
    id: z.string(),
    isOfficial: z.boolean(),
    minimumAttendancePercent: z.number(),
    appliesTo: z.string(),
    notes: z.string(),
  }),
  courses: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      attended: z.number().int().min(0),
      total: z.number().int().min(0),
      futureScheduled: z.number().int().min(0),
      missesByOption: misses,
    }),
  ),
  opportunity: z.object({
    id: z.string(),
    name: z.string(),
    fictional: z.literal(true),
    start: iso,
    end: iso,
    registrationDeadline: iso,
    eligibility: z.string(),
    approval: z.string(),
  }),
  commitments: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["assignment", "assessment"]),
      courseId: z.string(),
      name: z.string(),
      dueAt: iso.optional(),
      modifiedDemoDueAt: iso.optional(),
      startsAt: iso.optional(),
      studyHoursDesired: z.number().optional(),
      source: z.string(),
    }),
  ),
  options: z.array(z.object({ id: z.enum(["full", "partial", "defer"]), label: z.string(), eligibility: z.string() })),
  expectedProjections: z.record(z.string(), z.record(z.string(), z.number())),
  securityExample: z.object({
    actor: z.string(),
    targetStudent: z.string(),
    resource: z.string(),
    expectedServerResponse: z.number(),
  }),
});

export type Scenario = z.infer<typeof ScenarioSchema>;
export const scenario: Scenario = ScenarioSchema.parse(raw);

export function assignmentSeed() {
  const a = scenario.commitments.find((c) => c.type === "assignment");
  if (!a?.dueAt || !a.modifiedDemoDueAt) throw new Error("Seed assignment is missing due dates");
  return { ...a, dueAt: a.dueAt, modifiedDemoDueAt: a.modifiedDemoDueAt };
}

export function assessmentSeed() {
  const a = scenario.commitments.find((c) => c.type === "assessment");
  if (!a?.startsAt || a.studyHoursDesired === undefined) throw new Error("Seed assessment is incomplete");
  return { ...a, startsAt: a.startsAt, studyHoursDesired: a.studyHoursDesired };
}

function seedRef(id: string, label: string, source: EvidenceRef["source"] = "academic_simulator"): EvidenceRef {
  return { id, source, retrievedAt: scenario.dataAsOf, verification: "synthetic", recordVersion: 1, label };
}

/** Planning facts straight from the seed (used by unit tests and as the DB seed source). */
export function seedFacts(overrides: { assignmentDueAt?: string } = {}): PlanningFacts {
  const a = assignmentSeed();
  const s = assessmentSeed();
  return {
    now: scenario.dataAsOf,
    courses: scenario.courses.map((c) => ({ ...c, ref: seedRef(c.id, `${c.code} attendance record`) })),
    policy: { ...scenario.policy, ref: seedRef(scenario.policy.id, "Sample attendance policy", "sample_policy") },
    opportunity: { ...scenario.opportunity, ref: seedRef(scenario.opportunity.id, "CyberForge Sprint listing", "curated_example") },
    assignment: { id: a.id, courseId: a.courseId, name: a.name, dueAt: overrides.assignmentDueAt ?? a.dueAt, ref: seedRef(a.id, "Database mini-project record") },
    assessment: { id: s.id, courseId: s.courseId, name: s.name, startsAt: s.startsAt, studyHoursDesired: s.studyHoursDesired, ref: seedRef(s.id, "Internal assessment record") },
  };
}
