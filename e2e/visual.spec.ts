import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Reviewed visual baselines (e2e/visual.spec.ts-snapshots). They are generated on macOS and
// checked by a person before being committed; Linux CI renders fonts differently, so the
// comparison runs on macOS only. Real timestamps and durations are masked via [data-dynamic].
test.skip(process.platform !== "darwin", "Visual baselines are reviewed on macOS; Linux font rendering differs.");
test.describe.configure({ mode: "serial" });

let page: Page;
const opts = () => ({
  fullPage: true,
  maxDiffPixelRatio: 0.01,
  mask: [page.locator("[data-dynamic]"), page.locator("time")],
  animations: "disabled" as const,
  stylePath: path.join(__dirname, "visual.css"),
});

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("/overview");
  await page.getByRole("button", { name: "Open Maya's sample workspace" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Good evening/ })).toBeVisible();
  await page.request.post("/api/demo/reset", { data: {} });
});
test.afterAll(async () => page.close());

async function settle() {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.querySelector(".toast")?.classList.remove("show"));
  await page.waitForTimeout(300);
}

test("home — fresh", async () => {
  await page.goto("/overview");
  await settle();
  await expect(page).toHaveScreenshot("home-fresh.png", opts());
});

test("decisions — evaluated", async () => {
  await page.goto("/decisions");
  await page.getByTestId("evaluate").click();
  await expect(page.getByTestId("recommendation")).toBeVisible();
  await settle();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("decisions-evaluated.png", opts());
});

test("decisions — replanned", async () => {
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("approved-note")).toBeVisible();
  await page.getByTestId("source-change").click();
  await expect(page.getByTestId("replan-notice")).toBeVisible();
  await settle();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("decisions-replanned.png", opts());
});

test("security — before the live check", async () => {
  await page.goto("/trust");
  await settle();
  await expect(page).toHaveScreenshot("security.png", opts());
});
