import type { FactChange, PlanResult, RevisionDiff, TaskChange, TaskDraft } from "@/lib/contracts";
import { formatIst } from "./time";

const FACT_LABELS: Record<keyof PlanResult["facts"], string> = {
  assignmentDueAt: "Database mini-project due",
  assessmentStartsAt: "Assessment starts",
  eventStart: "Event starts",
  eventEnd: "Event ends",
  registrationDeadline: "Registration closes",
  policyThreshold: "Sample attendance threshold",
  policyIsOfficial: "Policy is official",
};

function pickTask(t: TaskDraft) {
  return { title: t.title, detail: t.detail, dueAt: t.dueAt, block: t.block };
}

function display(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && /T\d{2}:\d{2}/.test(v)) return formatIst(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return v as string | number;
}

/** Semantic comparison of two plan results; ignores computedAt. */
export function diffPlans(before: PlanResult, after: PlanResult, fromRevision: number, toRevision: number): RevisionDiff {
  const facts: FactChange[] = [];
  for (const k of Object.keys(FACT_LABELS) as (keyof PlanResult["facts"])[]) {
    if (before.facts[k] !== after.facts[k]) {
      facts.push({ field: k, label: FACT_LABELS[k], before: display(before.facts[k]), after: display(after.facts[k]) });
    }
  }

  const tasks: TaskChange[] = [];
  const projectionChanges: RevisionDiff["projectionChanges"] = [];
  for (const a of after.options) {
    const b = before.options.find((o) => o.id === a.id);
    const beforeTasks = new Map((b?.tasks ?? []).map((t) => [t.taskKey, t]));
    const afterTasks = new Map(a.tasks.map((t) => [t.taskKey, t]));
    for (const [key, t] of afterTasks) {
      const prev = beforeTasks.get(key);
      if (!prev) tasks.push({ optionId: a.id, taskKey: key, change: "added", after: pickTask(t) });
      else if (JSON.stringify(pickTask(prev)) !== JSON.stringify(pickTask(t))) {
        tasks.push({ optionId: a.id, taskKey: key, change: "changed", before: pickTask(prev), after: pickTask(t) });
      }
    }
    for (const [key, t] of beforeTasks) {
      if (!afterTasks.has(key)) tasks.push({ optionId: a.id, taskKey: key, change: "removed", before: pickTask(t) });
    }
    for (const p of a.projections) {
      const prev = b?.projections.find((x) => x.courseId === p.courseId);
      if (!prev || prev.percent !== p.percent) {
        projectionChanges.push({ optionId: a.id, courseId: p.courseId, before: prev?.percent ?? null, after: p.percent });
      }
    }
  }

  const recommendationChanged = before.recommendation.optionId !== after.recommendation.optionId;
  const conflictsChanged = JSON.stringify(before.conflicts) !== JSON.stringify(after.conflicts);
  return {
    fromRevision,
    toRevision,
    facts,
    tasks,
    recommendationChanged,
    projectionChanges,
    changed: facts.length > 0 || tasks.length > 0 || recommendationChanged || projectionChanges.length > 0 || conflictsChanged,
  };
}

/** True when two results would present the student with a different plan. */
export function semanticallyEqual(a: PlanResult, b: PlanResult): boolean {
  const strip = (r: PlanResult) => JSON.stringify({ ...r, computedAt: undefined, evidence: r.evidence.map((e) => e.id) });
  return strip(a) === strip(b);
}
