import { beforeAll, describe, expect, it } from "vitest";
import { useTempDb } from "./support/setup-db";
import { params, req } from "./support/http";

// A closed registration is a hard constraint: participating options are not recommended and the
// server refuses to approve them. Uses its own database with the listing's deadline in the past.
useTempDb();

const { getAppDb } = await import("@/lib/server/app");
const { run } = await import("@/lib/server/db");
const { issueSampleSession } = await import("@/lib/server/session");
const evaluate = await import("@/app/api/mission/evaluate/route");
const approve = await import("@/app/api/mission/[id]/approve/route");

const db = getAppDb();
let token = "";
type Mission = { id: string; revision: number; challenge: string; drafts: Record<string, { id: string }[]>; result: { recommendation: { optionId: string }; options: { id: string; hardViolations: string[] }[]; facts: { registration: { status: string } } } };
let mission: Mission;

beforeAll(async () => {
  run(db, "UPDATE source_records SET payload_json = json_set(payload_json, '$.registrationDeadline', '2026-10-20T23:59:00+05:30') WHERE id = 'opp_cyberforge'");
  token = issueSampleSession(db).token;
  const res = await evaluate.POST(req("/api/mission/evaluate", { method: "POST", token, body: { missionType: "event_participation", opportunityId: "opp_cyberforge" } }));
  mission = (await res.json()).mission;
});

const approveOption = (optionId: string, key: string) =>
  approve.POST(
    req(`/api/mission/${mission.id}/approve`, {
      method: "POST",
      token,
      body: { revision: mission.revision, optionId, actionIds: mission.drafts[optionId].map((d) => d.id), challenge: mission.challenge, idempotencyKey: key },
    }),
    params({ id: mission.id }),
  );

describe("expired registration", () => {
  it("is reported as closed and blocks both participating options", () => {
    expect(mission.result.facts.registration.status).toBe("closed");
    for (const id of ["full", "partial"]) {
      expect(mission.result.options.find((o) => o.id === id)!.hardViolations.join(" ")).toMatch(/Registration closed/);
    }
  });
  it("recommends deferring instead of an option that assumes registration is possible", () => {
    expect(mission.result.recommendation.optionId).toBe("defer");
  });
  it("the server refuses to approve an infeasible option (422) and accepts the feasible one", async () => {
    const blocked = await approveOption("partial", "closed-partial-01");
    expect(blocked.status).toBe(422);
    expect((await blocked.json()).error).toBe("OPTION_NOT_FEASIBLE");
    expect((await approveOption("defer", "closed-defer-001")).status).toBe(200);
  });
});
