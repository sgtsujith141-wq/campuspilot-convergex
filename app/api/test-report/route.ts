import type { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { json, withStudent } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Assertion = { fullName?: string; title?: string; status?: string; ancestorTitles?: string[] };
type FileResult = { name?: string; assertionResults?: Assertion[] };

// Serves the most recent *recorded* local test run (reports/vitest.json written by
// `npm run test:report`). Names and pass/fail only; nothing is synthesised here.
export async function GET(req: NextRequest) {
  return withStudent(req, () => {
    try {
      const file = path.join(process.cwd(), "reports", "vitest.json");
      const report = JSON.parse(readFileSync(file, "utf8"));
      const files: FileResult[] = report.testResults ?? [];
      const tests = files.flatMap((f) =>
        (f.assertionResults ?? []).map((a) => ({
          file: path.basename(f.name ?? ""),
          name: a.fullName ?? a.title ?? "",
          status: a.status ?? "unknown",
        })),
      );
      return json({
        available: true,
        startTime: report.startTime ?? null,
        numTotalTests: report.numTotalTests ?? tests.length,
        numPassedTests: report.numPassedTests ?? tests.filter((t) => t.status === "passed").length,
        numFailedTests: report.numFailedTests ?? tests.filter((t) => t.status === "failed").length,
        tests,
      });
    } catch {
      return json({ available: false });
    }
  });
}
