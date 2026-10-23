import { expect, test } from "@playwright/test";

// Captures every key screen and state at six viewport sizes for human review.
// 1440×900 and 390×844 go to docs/screenshots/v2 (committed); the rest to test-results/screens.
const SIZES = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [320, 700],
] as const;

for (const [w, h] of SIZES) {
  test(`screens at ${w}×${h}`, async ({ browser }) => {
    const dir = w === 1440 || w === 390 ? `docs/screenshots/v2/${w}x${h}` : `test-results/screens/${w}x${h}`;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const shot = async (name: string, fullPage = true) => {
      await page.evaluate(() => document.querySelector(".toast")?.classList.remove("show"));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
    };
    await page.goto("/overview");
    await shot("00-sign-in", false);
    await page.getByRole("button", { name: "Open Maya's sample workspace" }).click();
    await expect(page.getByTestId("summary")).toBeVisible();
    await page.request.post("/api/demo/reset", { data: {} });
    await page.goto("/overview");
    await shot("01-home");
    await page.goto("/decisions");
    await shot("02-decisions-setup");
    await page.getByTestId("evaluate").click();
    await expect(page.getByTestId("recommendation")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot("03-decisions-evaluated");
    await page.getByTestId("ask-panel").getByRole("button", { name: "What is my biggest attendance risk?" }).click();
    await expect(page.getByTestId("ask-answer")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("ask-panel").scrollIntoViewIfNeeded();
    await shot("03b-local-ai-answer", false);
    await page.getByTestId("approve").click();
    await expect(page.getByTestId("approved-note")).toBeVisible();
    await page.getByTestId("source-change").click();
    await expect(page.getByTestId("replan-notice")).toBeVisible();
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot("04-decisions-replanned");
    await page.getByTestId("replan-notice").scrollIntoViewIfNeeded();
    await shot("05-replan-moment", false);
    await page.goto("/overview");
    await shot("06-home-needs-review");
    await page.goto("/agents");
    await page.locator(".run-btn", { hasText: "Asked:" }).first().click();
    await shot("07a-activity-local-ai");
    await page.locator(".run-btn", { hasText: "Re-planned" }).first().click();
    await shot("07-activity");
    await page.goto("/trust");
    await page.getByTestId("run-probe").click();
    await expect(page.getByTestId("probe-results")).toHaveAttribute("data-state", "done");
    await shot("08-security");
    await page.close();
  });
}
