import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Automated WCAG 2.1 A/AA scan (axe-core) of every screen in its main states, including
// colour contrast. Automated checks catch a subset of issues; they are not a full audit.
test.describe.configure({ mode: "serial" });

let page: Page;

async function scan(label: string) {
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `${label} accessibility violations`).toEqual([]);
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
});
test.afterAll(async () => page.context().close());

test("sign-in screen", async () => {
  await page.context().clearCookies();
  await page.goto("/overview");
  await scan("sign-in");
  await page.getByRole("button", { name: "Open Maya's sample workspace" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Good evening/ })).toBeVisible();
  await page.request.post("/api/demo/reset", { data: {} });
});

test("home (fresh)", async () => {
  await page.goto("/overview");
  await scan("home");
});

test("decisions: setup, evaluated, evidence dialog, approved, replanned", async () => {
  await page.goto("/decisions");
  await scan("decisions setup");
  await page.getByTestId("evaluate").click();
  await expect(page.getByTestId("recommendation")).toBeVisible();
  await scan("decisions evaluated");
  await page.getByRole("button", { name: "How it’s calculated" }).click();
  await scan("evidence dialog");
  await page.keyboard.press("Escape");
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("approved-note")).toBeVisible();
  await page.getByTestId("source-change").click();
  await expect(page.getByTestId("replan-notice")).toBeVisible();
  await scan("decisions replanned");
});

test("home (needs review), activity, security", async () => {
  await page.goto("/overview");
  await scan("home after replan");
  await page.goto("/agents");
  await scan("activity");
  await page.goto("/trust");
  await page.getByTestId("run-probe").click();
  await expect(page.getByTestId("probe-results")).toHaveAttribute("data-state", "done");
  await scan("security");
});

test("mobile layout (390px)", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/overview", "/decisions", "/agents", "/trust"]) {
    await page.goto(route);
    await scan(`mobile ${route}`);
  }
});
