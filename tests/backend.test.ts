import { beforeAll, describe, expect, it } from "vitest";
import { useTempDb } from "./support/setup-db";
import { params, req } from "./support/http";

useTempDb();

const { getAppDb } = await import("@/lib/server/app");
const { all, one } = await import("@/lib/server/db");
const { createSessionForTest } = await import("@/lib/server/session");
const { OTHER_FIXTURE, MAYA_ID } = await import("@/lib/server/seed");
const sample = await import("@/app/api/session/sample/route");
const evaluate = await import("@/app/api/mission/evaluate/route");
const mission = await import("@/app/api/mission/[id]/route");
const approve = await import("@/app/api/mission/[id]/approve/route");
const courses = await import("@/app/api/courses/[id]/route");
const tasks = await import("@/app/api/tasks/route");
const trace = await import("@/app/api/trace/[runId]/route");
const sourceChange = await import("@/app/api/demo/source-change/route");
const workspace = await import("@/app/api/workspace/route");

const db = getAppDb();
let maya = "";
let missionId = "";
const MISSION = { missionType: "event_participation", opportunityId: "opp_cyberforge" };

async function getMission() {
  const res = await mission.GET(req(`/api/mission/${missionId}`, { token: maya }), params({ id: missionId }));
  return res.json();
}
async function approvePlan(body: Record<string, unknown>, token = maya, id = missionId) {
  return approve.POST(req(`/api/mission/${id}/approve`, { method: "POST", token, body }), params({ id }));
}
/** Non-superseded tasks; the UNIQUE(student, mission, task_key) constraint rules out duplicates. */
const taskCount = () => (one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM tasks WHERE student_id = ? AND status != 'superseded'", MAYA_ID)!.n);
const approvalsFor = (revision: number) => all<{ id: string; status: string; option_id: string }>(db, "SELECT id, status, option_id FROM approvals WHERE student_id = ? AND revision = ? ORDER BY created_at", MAYA_ID, revision);
const otherState = () => ({
  mission: one(db, "SELECT revision, status FROM missions WHERE id = ?", OTHER_FIXTURE.missionId),
  approvals: one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM approvals WHERE student_id = ?", OTHER_FIXTURE.studentId)!.n,
  tasks: one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM tasks WHERE student_id = ?", OTHER_FIXTURE.studentId)!.n,
});

beforeAll(async () => {
  // Identity input is ignored: the sample login can only ever issue Maya's session.
  const res = await sample.POST(req("/api/session/sample", { method: "POST", body: { studentId: OTHER_FIXTURE.studentId } }));
  expect(res.status).toBe(200);
  maya = /cp_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1];
});

describe("session + mission evaluation", () => {
  it("sample login issues an httpOnly SameSite=Strict session for the fictional Maya only", async () => {
    const res = await sample.POST(req("/api/session/sample", { method: "POST", body: {} }));
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=strict/i);
    const ws = await (await workspace.GET(req("/api/workspace", { token: maya }))).json();
    expect(ws.student.name).toBe("Maya Rao");
    expect(ws.student.fictional).toBe(true);
  });

  it("unauthenticated requests get 401", async () => {
    expect((await workspace.GET(req("/api/workspace"))).status).toBe(401);
    expect((await approvePlan({}, "bogus-token")).status).toBe(401);
  });

  it("evaluates the mission: revision 1, seed numbers, conditional partial recommendation", async () => {
    const res = await evaluate.POST(req("/api/mission/evaluate", { method: "POST", token: maya, body: MISSION }));
    expect(res.status).toBe(201);
    const body = await res.json();
    missionId = body.mission.id;
    expect(body.mission.missionType).toBe("event_participation");
    expect(body.mission.goal).toMatch(/^Can I attend CyberForge Sprint\?/);
    expect(body.mission.revision).toBe(1);
    expect(body.mode).toBe("deterministic");
    const ns = (o: string) => body.mission.result.options.find((x: { id: string }) => x.id === o).projections.find((p: { courseId: string }) => p.courseId === "course_ns").percent;
    expect(ns("full")).toBeCloseTo(74.193548, 5);
    expect(ns("partial")).toBeCloseTo(77.419355, 5);
    expect(ns("defer")).toBeCloseTo(80.645161, 5);
    expect(body.mission.result.recommendation).toMatchObject({ optionId: "partial", conditional: true });
    expect(body.mission.drafts.partial).toHaveLength(3);
    expect(body.mission.approval).toBeNull();
  });

  it("evaluate cannot be pointed at another student via the body", async () => {
    const res = await evaluate.POST(req("/api/mission/evaluate", { method: "POST", token: maya, body: { ...MISSION, studentId: OTHER_FIXTURE.studentId } }));
    expect(res.status).toBe(400);
  });

  it("free-text goals are not accepted: the guided workflow supports one mission type", async () => {
    const freeText = await evaluate.POST(req("/api/mission/evaluate", { method: "POST", token: maya, body: { goal: "Book me a flight to Goa", opportunityId: "opp_cyberforge" } }));
    expect(freeText.status).toBe(400);
    const unsupported = await evaluate.POST(req("/api/mission/evaluate", { method: "POST", token: maya, body: { missionType: "book_travel", opportunityId: "opp_cyberforge" } }));
    expect(unsupported.status).toBe(400);
  });

  it("records a real trace run from executed tool calls (mode=deterministic, no model)", () => {
    const run = one<{ id: string; mode: string; model: string | null }>(db, "SELECT * FROM trace_runs WHERE mission_id = ? AND kind = 'evaluate'", missionId)!;
    expect(run.mode).toBe("deterministic");
    expect(run.model).toBeNull();
    const tools = all<{ tool: string | null }>(db, "SELECT tool FROM trace_events WHERE run_id = ? ORDER BY seq", run.id).map((e) => e.tool).filter(Boolean);
    expect(tools).toEqual([
      "get_my_courses", "get_my_attendance", "get_my_commitments", "get_applicable_policy",
      "get_event", "verify_event_rules", "calculate_attendance", "calculate_attendance", "calculate_attendance",
      "calculate_conflicts", "enumerate_options", "propose_task_drafts",
    ]);
  });
});

describe("authorization — cross-student isolation (server-side)", () => {
  it("own course → 200", async () => {
    const res = await courses.GET(req("/api/courses/course_ns", { token: maya }), params({ id: "course_ns" }));
    expect(res.status).toBe(200);
    expect((await res.json()).attended).toBe(21);
  });
  it("Maya reading Student B's course → 403 with no record data", async () => {
    const res = await courses.GET(req(`/api/courses/${OTHER_FIXTURE.courseId}`, { token: maya }), params({ id: OTHER_FIXTURE.courseId }));
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).not.toMatch(/attended|26|Network/);
  });
  it("foreign and nonexistent IDs are indistinguishable (uniform 403)", async () => {
    const a = await courses.GET(req("/api/courses/does_not_exist", { token: maya }), params({ id: "does_not_exist" }));
    const b = await courses.GET(req(`/api/courses/${OTHER_FIXTURE.courseId}`, { token: maya }), params({ id: OTHER_FIXTURE.courseId }));
    expect(a.status).toBe(b.status);
    expect(await a.json()).toEqual(await b.json());
  });
  it("Maya reading Student B's mission or trace → 403", async () => {
    const m = await mission.GET(req(`/api/mission/${OTHER_FIXTURE.missionId}`, { token: maya }), params({ id: OTHER_FIXTURE.missionId }));
    expect(m.status).toBe(403);
    const otherRun = one<{ id: string }>(db, "SELECT id FROM trace_runs WHERE student_id = ?", OTHER_FIXTURE.studentId)!;
    const t = await trace.GET(req(`/api/trace/${otherRun.id}`, { token: maya }), params({ runId: otherRun.id }));
    expect(t.status).toBe(403);
  });
  it("Student B cannot read Maya's mission either", async () => {
    const other = createSessionForTest(db, OTHER_FIXTURE.studentId);
    const m = await mission.GET(req(`/api/mission/${missionId}`, { token: other }), params({ id: missionId }));
    expect(m.status).toBe(403);
  });
  it("Maya approving Student B's plan → 403 and no mutation", async () => {
    const before = otherState();
    const otherDraft = one<{ id: string }>(db, "SELECT id FROM action_drafts WHERE mission_id = ? LIMIT 1", OTHER_FIXTURE.missionId)!;
    const res = await approvePlan({ revision: 1, optionId: "partial", actionIds: [otherDraft.id], challenge: "x".repeat(24), idempotencyKey: "forged-cross-owner-1" }, maya, OTHER_FIXTURE.missionId);
    expect(res.status).toBe(403);
    expect(otherState()).toEqual(before);
  });
  it("denials are written to the server audit log", () => {
    const denied = all<{ outcome: string }>(db, "SELECT outcome FROM audit_log WHERE student_id = ? AND outcome LIKE 'denied:403%'", MAYA_ID);
    expect(denied.length).toBeGreaterThanOrEqual(4);
  });
});

describe("approval gateway", () => {
  it("rejects approval without the per-revision consent challenge → 403, no tasks", async () => {
    const m = await getMission();
    const res = await approvePlan({ revision: 1, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: "not-the-challenge", idempotencyKey: "no-consent-0001" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("CONSENT_REQUIRED");
    expect(taskCount()).toBe(0);
  });
  it("rejects forged action IDs → 403", async () => {
    const m = await getMission();
    const res = await approvePlan({ revision: 1, optionId: "partial", actionIds: ["act_0000000000000000"], challenge: m.challenge, idempotencyKey: "forged-ids-0001" });
    expect(res.status).toBe(403);
    expect(taskCount()).toBe(0);
  });
  it("rejects actions from a different option than the one approved → 403", async () => {
    const m = await getMission();
    const res = await approvePlan({ revision: 1, optionId: "partial", actionIds: [m.drafts.full[0].id], challenge: m.challenge, idempotencyKey: "wrong-option-0001" });
    expect(res.status).toBe(403);
  });
  it("valid approval executes create_local_task and is readable from the server", async () => {
    const m = await getMission();
    const res = await approvePlan({ revision: 1, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r1-0001" });
    expect(res.status).toBe(200);
    expect((await res.json()).replayed).toBe(false);
    const list = await (await tasks.GET(req("/api/tasks", { token: maya }))).json();
    expect(list.tasks).toHaveLength(3);
    expect(list.tasks.every((t: { status: string; originRevision: number }) => t.status === "active" && t.originRevision === 1)).toBe(true);
    expect((await getMission()).approval).toMatchObject({ revision: 1, optionId: "partial" });
  });
  it("double approve (same key, then a fresh key) never duplicates tasks", async () => {
    const m = await getMission();
    const body = { revision: 1, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge };
    const r1 = await approvePlan({ ...body, idempotencyKey: "approve-r1-0001" });
    const r2 = await approvePlan({ ...body, idempotencyKey: "approve-r1-0002" });
    expect((await r1.json()).replayed).toBe(true);
    expect((await r2.json()).replayed).toBe(true);
    expect(taskCount()).toBe(3);
  });
});

describe("source change → reactive replan (no new prompt)", () => {
  let r1Challenge = "";
  let r1Actions: string[] = [];
  it("advancing the deadline bumps the source version and plan revision and invalidates approval", async () => {
    const before = await getMission();
    r1Challenge = before.challenge;
    r1Actions = before.drafts.partial.map((d: { id: string }) => d.id);
    const otherBefore = otherState();
    const res = await sourceChange.POST(req("/api/demo/source-change", { method: "POST", token: maya, body: { event: "advance_assignment_deadline" } }));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toMatchObject({ changed: true, sourceId: "assignment_db", version: 2, dueAt: "2026-10-28T19:00:00+05:30" });
    expect(out.replans).toHaveLength(1);
    expect(out.replans[0]).toMatchObject({ missionId, fromRevision: 1, toRevision: 2, changed: true, invalidatedApprovals: 1 });
    const after = await getMission();
    expect(after.revision).toBe(2);
    expect(after.approval).toBeNull();
    expect(after.lastInvalidated.reason).toMatch(/SOURCE_UPDATED assignment_db v1→v2/);
    expect(after.diff.facts[0]).toMatchObject({ before: "Oct 29, 6:00 PM", after: "Oct 28, 7:00 PM" });
    expect(after.diff.tasks.filter((t: { optionId: string }) => t.optionId === "partial").map((t: { taskKey: string }) => t.taskKey)).toEqual(["db_project"]);
    expect(after.drafts.partial.find((d: { taskKey: string }) => d.taskKey === "db_project").detail).toMatch(/Oct 27, 6–9 PM/);
    // previously executed tasks are flagged, not silently kept as current
    expect(all<{ status: string }>(db, "SELECT status FROM tasks WHERE student_id = ?", MAYA_ID).every((t) => t.status === "needs_review")).toBe(true);
    // unrelated mission (Student B) untouched
    expect(otherState()).toEqual(otherBefore);
    // replan run recorded, triggered by the source watcher
    const run = one<{ id: string }>(db, "SELECT id FROM trace_runs WHERE mission_id = ? AND kind = 'replan'", missionId)!;
    expect(one<{ actor: string }>(db, "SELECT actor FROM trace_events WHERE run_id = ? AND seq = 1", run.id)!.actor).toBe("Source watcher");
  });
  it("an approval for the old revision is refused with 409 STALE_REVISION and no mutation", async () => {
    const snapshot = all(db, "SELECT * FROM tasks WHERE student_id = ? ORDER BY id", MAYA_ID);
    const res = await approvePlan({ revision: 1, optionId: "partial", actionIds: r1Actions, challenge: r1Challenge, idempotencyKey: "stale-attempt-01" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("STALE_REVISION");
    expect(all(db, "SELECT * FROM tasks WHERE student_id = ? ORDER BY id", MAYA_ID)).toEqual(snapshot);
  });
  it("approving revision 2 updates the existing tasks instead of duplicating them", async () => {
    const m = await getMission();
    const res = await approvePlan({ revision: 2, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r2-0001" });
    expect(res.status).toBe(200);
    expect(taskCount()).toBe(3);
    const db1 = one<{ detail: string; origin_revision: number; status: string }>(db, "SELECT * FROM tasks WHERE student_id = ? AND task_key = 'db_project'", MAYA_ID)!;
    expect(db1).toMatchObject({ origin_revision: 2, status: "active" });
    expect(db1.detail).toMatch(/Oct 27/);
  });
  it("REGRESSION: an exact replay of the invalidated revision-1 approval is refused, not reported as active", async () => {
    const before = all(db, "SELECT id, status, origin_revision, approval_id FROM tasks WHERE student_id = ? ORDER BY id", MAYA_ID);
    // Same key, revision, option, actions and challenge as the original revision-1 approval.
    const res = await approvePlan({ revision: 1, optionId: "partial", actionIds: r1Actions, challenge: r1Challenge, idempotencyKey: "approve-r1-0001" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("STALE_REVISION");
    expect(approvalsFor(1).map((a) => a.status)).toEqual(["invalidated"]);
    expect(all(db, "SELECT id, status, origin_revision, approval_id FROM tasks WHERE student_id = ? ORDER BY id", MAYA_ID)).toEqual(before);
  });

  it("exact sequential retries of the active approval are no-ops (one approval, no new tasks)", async () => {
    const m = await getMission();
    const body = { revision: 2, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r2-0001" };
    const snapshot = all(db, "SELECT * FROM tasks WHERE student_id = ? ORDER BY id", MAYA_ID);
    for (let i = 0; i < 3; i++) {
      const res = await approvePlan(body);
      expect(res.status).toBe(200);
      expect((await res.json()).replayed).toBe(true);
    }
    expect(approvalsFor(2)).toHaveLength(1);
    expect(all(db, "SELECT * FROM tasks WHERE student_id = ? ORDER BY id", MAYA_ID)).toEqual(snapshot);
  });

  it("a reused key with a different option at the same revision is refused", async () => {
    const m = await getMission();
    const res = await approvePlan({ revision: 2, optionId: "defer", actionIds: m.drafts.defer.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r2-0001" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("a replaced approval is never reinstated by retrying its key", async () => {
    const m = await getMission();
    const defer = await approvePlan({ revision: 2, optionId: "defer", actionIds: m.drafts.defer.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r2-defer" });
    expect(defer.status).toBe(200);
    const retry = await approvePlan({ revision: 2, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r2-0001" });
    expect(retry.status).toBe(409);
    expect((await retry.json()).error).toBe("APPROVAL_SUPERSEDED");
    expect(approvalsFor(2).filter((a) => a.status === "active").map((a) => a.option_id)).toEqual(["defer"]);
    // Switching back is an explicit new approval, not a replay.
    const back = await approvePlan({ revision: 2, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r2-0002" });
    expect(back.status).toBe(200);
    expect(approvalsFor(2).filter((a) => a.status === "active").map((a) => a.option_id)).toEqual(["partial"]);
    expect(taskCount()).toBe(3);
  });

  it("re-using an idempotency key for a different revision is refused", async () => {
    const m = await getMission();
    const res = await approvePlan({ revision: 2, optionId: "defer", actionIds: m.drafts.defer.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r1-0001" });
    expect(res.status).toBe(409);
  });
  it("restoring the deadline replans to revision 3 without duplicating saved tasks", async () => {
    const res = await sourceChange.POST(req("/api/demo/source-change", { method: "POST", token: maya, body: { event: "restore_assignment_deadline" } }));
    const out = await res.json();
    expect(out.replans[0]).toMatchObject({ fromRevision: 2, toRevision: 3 });
    const m = await getMission();
    await approvePlan({ revision: 3, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "approve-r3-0001" });
    expect(taskCount()).toBe(3);
    expect(one<{ detail: string }>(db, "SELECT detail FROM tasks WHERE student_id = ? AND task_key = 'db_project'", MAYA_ID)!.detail).toMatch(/Oct 28, 6–9 PM/);
  });
  it("repeating a no-op source change does not create a revision", async () => {
    const res = await sourceChange.POST(req("/api/demo/source-change", { method: "POST", token: maya, body: { event: "restore_assignment_deadline" } }));
    expect((await res.json()).changed).toBe(false);
    expect((await getMission()).revision).toBe(3);
  });
});

describe("request hygiene", () => {
  it("a browser-flagged cross-site mutation (Sec-Fetch-Site) → 403 even without an Origin header", async () => {
    const r = req("/api/demo/source-change", { method: "POST", token: maya, body: { event: "advance_assignment_deadline" }, origin: null });
    r.headers.set("sec-fetch-site", "cross-site");
    expect((await sourceChange.POST(r)).status).toBe(403);
  });
  it("oversized bodies → 413", async () => {
    const r = req("/api/demo/source-change", { method: "POST", token: maya, body: { event: "advance_assignment_deadline" } });
    r.headers.set("content-length", String(64 * 1024));
    expect((await sourceChange.POST(r)).status).toBe(413);
  });
  it("malformed IDs get the uniform 403 and are not echoed into the audit log", async () => {
    const weird = "x".repeat(300) + "'; DROP TABLE missions; --";
    const res = await courses.GET(req(`/api/courses/${encodeURIComponent(weird)}`, { token: maya }), params({ id: weird }));
    expect(res.status).toBe(403);
    const last = one<{ target: string }>(db, "SELECT target FROM audit_log WHERE student_id = ? ORDER BY rowid DESC LIMIT 1", MAYA_ID)!;
    expect(last.target).toBe("(malformed id)");
  });

  it("cross-origin mutation → 403", async () => {
    const res = await sourceChange.POST(req("/api/demo/source-change", { method: "POST", token: maya, body: { event: "advance_assignment_deadline" }, origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });
  it("non-JSON mutation → 415", async () => {
    const res = await sourceChange.POST(req("/api/demo/source-change", { method: "POST", token: maya, body: "event=advance", contentType: "application/x-www-form-urlencoded" }));
    expect(res.status).toBe(415);
  });
  it("demo routes are disabled when CAMPUSPILOT_DEMO_MODE=off", async () => {
    process.env.CAMPUSPILOT_DEMO_MODE = "off";
    try {
      expect((await sample.POST(req("/api/session/sample", { method: "POST", body: {} }))).status).toBe(404);
      const res = await sourceChange.POST(req("/api/demo/source-change", { method: "POST", token: maya, body: { event: "advance_assignment_deadline" } }));
      expect(res.status).toBe(404);
    } finally {
      delete process.env.CAMPUSPILOT_DEMO_MODE;
    }
  });
  it("no session token, other-student identifier or other-student data leaks into Maya's workspace payload", async () => {
    const ws = await (await workspace.GET(req("/api/workspace", { token: maya }))).text();
    expect(ws).not.toContain(OTHER_FIXTURE.studentId);
    expect(ws).not.toContain("Test Student B");
    expect(ws).not.toContain("OS lab report");
    expect(ws).not.toContain("oth_course_os");
    expect(ws).not.toContain(maya);
  });
});
