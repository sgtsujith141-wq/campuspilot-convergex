import { expect, test, type Page } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { E2E_DB } from "../playwright.config";

// One browser session walks the 90-second demo path in order; later steps depend on earlier state.
test.describe.configure({ mode: "serial" });

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

async function mayaCookie() {
  return (await page.context().cookies()).find((x) => x.name === "cp_session")!.value;
}

async function signIn() {
  await page.goto("/overview");
  await page.getByRole("button", { name: "Open Maya's sample workspace" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Good evening, Maya/ })).toBeVisible();
}

async function nav(label: string) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: label, exact: true }).click();
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
});
test.afterAll(async () => page.close());

test("sample login → home shows derived, data-driven state", async () => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Sign in to the demo workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Open Maya's sample workspace" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Good evening, Maya/ })).toBeVisible();
  // Start from the seed scenario regardless of what other spec files did.
  expect((await page.request.post("/api/demo/reset", { data: {} })).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("summary")).toHaveText("3 courses tracked · 1 decision to evaluate · 3 items need attention");
  await expect(page.getByTestId("attention").locator("li")).toHaveCount(3);
  await expect(page.locator(".course-table tbody tr")).toHaveCount(3);
  await expect(page.locator(".timeline .entry")).toHaveCount(4);
  await expect(page.getByText("Demo data")).toBeVisible();
  await expect(page.getByText("VTOP — not connected")).toBeVisible();
  await expect(page.getByText("No tasks yet")).toBeVisible();
});

test("navigation between all four screens works", async () => {
  for (const [label, heading] of [
    ["Decisions", "Evaluate a decision"],
    ["Activity", "Activity"],
    ["Security", "Security"],
    ["Home", "Good evening, Maya"],
  ]) {
    await nav(label);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(heading) })).toBeVisible();
  }
});

test("guided mission → three options: partial default 77.4, full 74.2, defer 80.6", async () => {
  await page.getByTestId("home-cta").click();
  await expect(page.getByRole("heading", { name: "Event participation check" })).toBeVisible();
  await expect(page.locator("textarea, input[type=text]")).toHaveCount(0); // no decorative free-text box
  await page.getByTestId("evaluate").click();
  await expect(page.locator("[data-option=partial]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("proj-course_ns")).toContainText("77.4%");
  await expect(page.getByTestId("ns-full")).toHaveText("74.2%");
  await expect(page.getByTestId("ns-partial")).toHaveText("77.4%");
  await expect(page.getByTestId("ns-defer")).toHaveText("80.6%");
  await page.locator("[data-option=full]").click();
  await expect(page.getByTestId("proj-course_ns")).toContainText("74.2%");
  await expect(page.getByTestId("formula-line")).toContainText("23/31 = 74.2%");
  await page.locator("[data-option=defer]").click();
  await expect(page.getByTestId("proj-course_ns")).toContainText("80.6%");
  await page.locator("[data-option=partial]").click();
  await expect(page.getByTestId("recommendation")).toContainText("Recommendation · conditional");
  await expect(page.getByTestId("recommendation")).toContainText("Attend selected sessions");
  await expect(page.getByTestId("recommendation").locator(".verify-list li")).toHaveCount(4);
});

test("evidence dialog explains the variables and the sample-policy caveat; Escape closes and restores focus", async () => {
  const trigger = page.getByRole("button", { name: "How it’s calculated" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("(A + H − M) / (T + H)");
  await expect(dialog).toContainText("24/31");
  await expect(dialog).toContainText("sample configuration");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("approval states are distinct; approving persists tasks on the server and reads them back", async () => {
  const status = page.getByTestId("approval-status");
  await expect(status).toContainText("Not approved");
  await expect(status.locator("li").nth(1)).toContainText("Not verified");
  await expect(status.locator("li").nth(2)).toContainText("Not verified");
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("approved-note")).toContainText("read them back");
  await expect(page.getByTestId("approved-note")).toContainText("not on-duty permission");
  const { tasks } = await (await page.request.get("/api/tasks")).json();
  expect(tasks.filter((t: { status: string }) => t.status === "active")).toHaveLength(3);
  await expect(status.locator("li").first()).toContainText("Approved · r1");
  await expect(status.locator("li").nth(1)).toContainText("Not verified"); // student approval ≠ OD approval
});

test("deadline Oct 29 6 PM → Oct 28 7 PM: plan revised, approval invalidated, no new prompt", async () => {
  const before = await (await page.request.get("/api/workspace")).json();
  await page.getByTestId("source-change").click();
  const update = page.getByTestId("replan-notice");
  await expect(update).toContainText("Revision 1 → 2");
  await expect(page.getByTestId("deadline-change")).toContainText("Oct 29, 6:00 PM");
  await expect(page.getByTestId("deadline-change")).toContainText("Oct 28, 7:00 PM");
  await expect(page.getByTestId("block-change")).toContainText("Oct 28, 6–9 PM");
  await expect(page.getByTestId("block-change")).toContainText("Oct 27, 6–9 PM");
  await expect(update).toContainText("Your previous approval needs review");
  await expect(page.getByTestId("due-text")).toHaveText("Oct 28, 7:00 PM");
  await expect(page.getByTestId("invalidated-note")).toContainText("invalidated");
  await expect(page.getByTestId("changed-task")).toBeVisible();
  await expect(page.getByTestId("revision")).toHaveText("Revision 2");

  // The stale revision-1 approval is refused by the server.
  const m = before.mission;
  const stale = await page.request.post(`/api/mission/${m.id}/approve`, {
    data: { revision: 1, optionId: "partial", actionIds: m.drafts.partial.map((d: { id: string }) => d.id), challenge: m.challenge, idempotencyKey: "e2e-stale-0001" },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toBe("STALE_REVISION");

  await page.getByTestId("review-revision").click();
  await expect(page.locator("#action-plan")).toBeInViewport();

  await nav("Home");
  await expect(page.getByTestId("attention")).toContainText("Your revised plan needs approval");
  await expect(page.getByTestId("attention")).toContainText("now due earlier");
});

test("a plan that changes while the student is reviewing it is refused and refreshed in the UI", async () => {
  await nav("Decisions");
  await expect(page.getByTestId("revision")).toHaveText("Revision 2");
  // Another tab restores the deadline (revision 3) while this page still shows revision 2.
  const res = await page.request.post("/api/demo/source-change", { data: { event: "restore_assignment_deadline" } });
  expect(res.status()).toBe(200);
  await page.getByTestId("approve").click();
  await expect(page.locator(".alert[role=alert]")).toContainText("The plan changed while you were reviewing it");
  await expect(page.getByTestId("revision")).toHaveText("Revision 3");
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("approved-note")).toBeVisible();
  const { tasks } = await (await page.request.get("/api/tasks")).json();
  expect(tasks).toHaveLength(3); // re-approval updates existing tasks instead of duplicating
});

test("activity shows recorded runs as readable steps, with a technical inspector and honest labels", async () => {
  await nav("Activity");
  await expect(page.getByText("Deterministic agent workflow · no model")).toBeVisible();
  await expect(page.locator(".run-btn")).toHaveCount(3);
  await page.locator(".run-btn", { hasText: "Revision 2" }).click();
  const detail = page.getByTestId("run-detail");
  await expect(detail).toContainText("Detected a source update");
  await expect(detail).toContainText("Identified the affected plan");
  await expect(detail).toContainText("Invalidated the outdated approval");
  await page.locator(".run-btn", { hasText: "Evaluated the decision" }).click();
  await expect(detail).toContainText("Read course records");
  const step = detail.locator(".step").filter({ hasText: "Read course records" });
  await step.getByText("Inspect").click();
  await expect(step.locator(".inspect")).toContainText("get_my_courses");
  await expect(detail).toContainText("None"); // model
  await expect(page.getByText(/Live AI agent run/)).toHaveCount(0);
});

test("security: live access check reports real 403s for another student and 200 for your own record", async () => {
  await nav("Security");
  await expect(page.getByTestId("probe-results")).toHaveAttribute("data-state", "idle");
  await page.getByTestId("run-probe").click();
  await expect(page.getByTestId("probe-results")).toHaveAttribute("data-state", "done");
  await expect(page.locator(".probe[data-pass=true]")).toHaveCount(4);
  await expect(page.locator(".probe[data-pass=false]")).toHaveCount(0);
  await expect(page.getByTestId("audit")).toContainText("Denied 403");
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

test("security headers are sent on every page", async ({ request }) => {
  const res = await request.get("/overview");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});

test("network failure: the UI explains what happened and nothing changes", async () => {
  await nav("Decisions");
  const due = await page.getByTestId("due-text").textContent();
  await page.route("**/api/demo/source-change", (route) => route.abort());
  await page.getByTestId("source-change").click();
  await expect(page.locator(".alert[role=alert]")).toContainText("did not respond");
  await expect(page.getByTestId("due-text")).toHaveText(due!);
  await page.unroute("**/api/demo/source-change");
});

test("expired session: the next action returns to sign-in with an explanation", async () => {
  await page.context().clearCookies();
  await page.getByRole("button", { name: /Re-run evaluation/ }).click();
  await expect(page.getByText("Your session ended")).toBeVisible();
  await page.getByRole("button", { name: "Open Maya's sample workspace" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Good evening, Maya/ })).toBeVisible();
});

test("presentation mode: P hides the sidebar and enlarges type, P again restores", async () => {
  await nav("Decisions");
  await expect(page.getByRole("heading", { level: 1, name: /Can I attend/ })).toBeVisible();
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await page.keyboard.press("p");
  await expect(page.locator(".sidebar")).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).not.toBe(before);
  await page.keyboard.press("p");
  await expect(page.locator(".sidebar")).toBeVisible();
});

test("demo reset restores the seed scenario through the UI", async () => {
  await page.getByTestId("reset").click();
  await page.getByTestId("confirm-reset").click();
  await expect(page.getByTestId("evaluate")).toBeVisible();
  await nav("Home");
  await expect(page.getByText("No tasks yet")).toBeVisible();
  await expect(page.getByTestId("summary")).toContainText("1 decision to evaluate");
});

for (const [w, h] of [
  [390, 844],
  [320, 700],
]) {
  test(`${w}px: mobile tab bar, no sidebar, no horizontal overflow on any screen`, async () => {
    await page.setViewportSize({ width: w, height: h });
    for (const route of ["/overview", "/decisions", "/agents", "/trust"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(scroll, route).toBeLessThanOrEqual(client);
      await expect(page.getByRole("navigation", { name: "Main (mobile)" })).toBeVisible();
      await expect(page.locator(".sidebar")).toBeHidden();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  });
}

test("offline fallback: the static prototype still works from a file", async ({ browser }) => {
  const p = await browser.newPage();
  await p.goto(`file://${path.join(process.cwd(), "prototype", "index.html")}`);
  await p.getByText("Explore my options").click();
  await expect(p.locator(".projected-course").first()).toContainText("77.4%");
  await p.close();
});

test("no uncaught page errors during the run", async () => {
  expect(pageErrors).toEqual([]);
});
