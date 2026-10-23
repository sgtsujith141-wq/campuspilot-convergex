import { expect, test } from "@playwright/test";

// Runs only on a machine with the local model installed:  AI_LIVE=1 npx playwright test e2e/ai-live.spec.ts
// Drives the real model through the UI; nothing is mocked.
test.skip(process.env.AI_LIVE !== "1", "Set AI_LIVE=1 on a machine running Ollama with the configured model.");
test.describe.configure({ mode: "serial" });

test("the real local model routes different questions to different investigations", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/overview");
  await page.getByRole("button", { name: "Open Maya's sample workspace" }).click();
  await expect(page.getByTestId("summary")).toBeVisible();
  await page.goto("/decisions");
  await expect(page.getByTestId("ai-status")).toContainText("Local AI", { timeout: 15_000 });
  const seen: { intent: string; tools: string }[] = [];
  for (const q of ["What is my biggest attendance risk?", "Which deadline conflicts with the hackathon?", "What must I verify before I can participate?"]) {
    await page.getByTestId("ask-panel").getByRole("button", { name: q }).click();
    await expect(page.getByTestId("ask-answer")).toContainText(q, { timeout: 60_000 });
    await expect(page.getByTestId("ask-answer")).toHaveAttribute("data-mode", "local_llm");
    seen.push({ intent: (await page.getByTestId("ask-intent").textContent())!, tools: (await page.getByTestId("ask-tools").textContent())! });
  }
  expect(new Set(seen.map((s) => s.intent)).size).toBe(3);
  expect(new Set(seen.map((s) => s.tools)).size).toBe(3);
  await page.getByTestId("ask-trace").click();
  await expect(page.getByTestId("run-mode")).toContainText("Local model");
  await expect(page.getByTestId("run-detail")).toContainText("Local model interpreted the question");
});
