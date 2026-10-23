import { expect, test, type Page } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { E2E_DB } from "../playwright.config";

// One browser session walks the 90-second demo path in order; later steps depend on earlier state.
test.describe.configure({ mode: "serial" });

const SHOTS = "docs/screenshots";
let page: Page;
const pageErrors: string[] = [];

/** Insert a session for a fixture student straight into the store (never possible over HTTP). */
function sessionFor(studentId: string) {
  const token = randomBytes(32).toString("base64url");
  const db = new DatabaseSync(E2E_DB);
  db.prepare("INSERT INTO sessions (token_hash, student_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    createHash("sha256").update(token).digest("hex"),
    studentId,
    new Date().toISOString(),
    new Date(Date.now() + 3600_000).toISOString(),
  );
  db.close();
  return token;
}

/** Documentation screenshot without the transient toast. */
async function shot(name: string) {
  await page.evaluate(() => document.querySelector(".toast")?.classList.remove("show"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/${name}` });
}

async function mayaCookie() {
  const c = (await page.context().cookies()).find((x) => x.name === "cp_session");
  return c!.value;
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
});
test.afterAll(async () => page.close());

test("sample login → overview with three attention cards and three courses", async () => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Open the sample student workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Open Maya's sample workspace" }).click();
  await expect(page.getByRole("heading", { name: /Good evening, Maya/ })).toBeVisible();
  await expect(page.locator(".attention-card")).toHaveCount(3);
  await expect(page.locator(".course-row")).toHaveCount(3);
  await expect(page.getByText("CONTROLLED DEMO")).toBeVisible();
  await expect(page.locator(".source.off")).toContainText("Not connected");
  await shot("01-overview.png");
});

test("navigation between all four screens works", async () => {
  for (const [label, heading] of [
    ["Decision studio", "Decision studio"],
    ["Agent activity", "Agent activity"],
    ["Trust center", "Trust center"],
    ["Overview", "Good evening, Maya"],
  ]) {
    await page.locator("nav").getByText(label, { exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(heading) })).toBeVisible();
  }
});

test("ask → options: partial default 77.4, full 74.2, defer 80.6", async () => {
  await page.getByRole("link", { name: /Explore my options/ }).click();
  await page.getByRole("button", { name: /Ask CampusPilot/ }).click();
  await expect(page.locator("[data-option=partial]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("proj-course_ns")).toContainText("77.4%");
  await expect(page.getByTestId("ns-full")).toHaveText("74.2%");
  await expect(page.getByTestId("ns-partial")).toHaveText("77.4%");
  await expect(page.getByTestId("ns-defer")).toHaveText("80.6%");
  await shot("02-decision-studio.png");
  await page.locator("[data-option=full]").click();
  await expect(page.getByTestId("proj-course_ns")).toContainText("74.2%");
  await page.locator("[data-option=defer]").click();
  await expect(page.getByTestId("proj-course_ns")).toContainText("80.6%");
  await page.locator("[data-option=partial]").click();
  await expect(page.getByText("Attend selected sessions — conditionally")).toBeVisible();
  await expect(page.locator(".condition")).toHaveCount(4);
});

test("evidence modal explains variables and the sample-policy caveat; Escape closes", async () => {
  await page.getByRole("button", { name: /How is this calculated/ }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("(A + H − M) / (T + H)");
  await expect(modal).toContainText("24/31");
  await expect(modal).toContainText("sample configuration");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
});

test("approve → persisted on the server and read back", async () => {
  await page.locator(".planner-bottom").scrollIntoViewIfNeeded();
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("approved-note")).toContainText("read back");
  const res = await page.request.get("/api/tasks");
  const { tasks } = await res.json();
  expect(tasks.filter((t: { status: string }) => t.status === "active")).toHaveLength(3);
  await page.locator(".planner-bottom").scrollIntoViewIfNeeded();
  await shot("03-plan-approved.png");
});

test("deadline moves Oct 29 6 PM → Oct 28 7 PM: replan, revision 2, approval invalidated, no new prompt", async () => {
  const before = await (await page.request.get("/api/workspace")).json();
  await page.getByTestId("source-change").click();
  await expect(page.getByTestId("replan-notice")).toContainText("revision 1 → 2");
  await expect(page.getByTestId("due-text")).toContainText("Oct 28, 7:00 PM");
  await expect(page.getByTestId("invalidated-note")).toContainText("invalidated");
  await expect(page.getByText(/Changed in revision 2/)).toBeVisible();
  await page.getByTestId("replan-notice").scrollIntoViewIfNeeded();
  await shot("04-replanned-notice.png");
  await page.locator(".planner-bottom").scrollIntoViewIfNeeded();
  await shot("05-replanned-plan.png");

  // The stale revision-1 approval is refused by the server.
  const m = before.mission;
  const stale = await page.request.post(`/api/mission/${m.id}/approve`, {
    data: { revision: 1, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "e2e-stale-0001" },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toBe("STALE_REVISION");

  await page.locator("nav").getByText("Overview", { exact: true }).click();
  await expect(page.locator(".attention-card").nth(1)).toContainText("Oct 28, 7:00 PM");
});

test("restore → revision 3; re-approval does not duplicate tasks", async () => {
  await page.locator("nav").getByText("Decision studio", { exact: true }).click();
  await page.getByTestId("source-change").click();
  await expect(page.getByTestId("due-text")).toContainText("Oct 29, 6:00 PM");
  await expect(page.locator(".question-card .tag-violet")).toHaveText("Revision 3");
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("approved-note")).toBeVisible();
  const { tasks } = await (await page.request.get("/api/tasks")).json();
  expect(tasks).toHaveLength(3);
});

test("agent activity shows persisted runs with real tool calls, labelled offline", async () => {
  await page.locator("nav").getByText("Agent activity", { exact: true }).click();
  await expect(page.getByText("OFFLINE GUIDED WORKFLOW")).toBeVisible();
  await expect(page.locator(".run-tab")).toHaveCount(3);
  await page.locator(".run-tab", { hasText: "Initial evaluation" }).click();
  await expect(page.locator(".activity-step code").first()).toContainText("get_my_courses");
  await expect(page.getByText("model = none")).toBeVisible();
  await shot("06-agent-activity.png");
});

test("trust center live probe: real HTTP 403s for Student B, 200 for own record", async () => {
  await page.locator("nav").getByText("Trust center", { exact: true }).click();
  await page.getByTestId("run-probe").click();
  const results = page.getByTestId("probe-results");
  await expect(results.locator(".probe.pass")).toHaveCount(4);
  await expect(results.locator(".probe.fail")).toHaveCount(0);
  await page.getByTestId("run-probe").scrollIntoViewIfNeeded();
  await shot("07-trust-center.png");
});

test("cross-user isolation over real HTTP, both directions", async ({ request }) => {
  const maya = await mayaCookie();
  const other = sessionFor("stu_other_demo");
  const ws = await (await request.get("/api/workspace", { headers: { cookie: `cp_session=${maya}` } })).json();
  const asB = { headers: { cookie: `cp_session=${other}` } };
  const asMaya = { headers: { cookie: `cp_session=${maya}` } };
  expect((await request.get("/api/courses/oth_course_ns", asB)).status()).toBe(200);
  expect((await request.get(`/api/mission/${ws.mission.id}`, asB)).status()).toBe(403);
  expect((await request.get("/api/courses/course_ns", asB)).status()).toBe(403);
  const r = await request.get("/api/courses/oth_course_ns", asMaya);
  expect(r.status()).toBe(403);
  expect(await r.text()).not.toContain("attended");
  expect((await request.get("/api/workspace")).status()).toBe(401);
});

test("presentation mode: P hides the sidebar, P again restores", async () => {
  await page.locator("nav").getByText("Decision studio", { exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Decision studio/ })).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.locator(".sidebar")).toBeHidden();
  await shot("08-presentation-mode.png");
  await page.keyboard.press("p");
  await expect(page.locator(".sidebar")).toBeVisible();
});

test("390px: no horizontal overflow on any screen", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/overview", "/decisions", "/agents", "/trust"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, route).toBeLessThanOrEqual(client);
  }
  await page.goto("/overview");
  await shot("09-mobile-overview.png");
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("no uncaught page errors during the run", async () => {
  expect(pageErrors).toEqual([]);
});
