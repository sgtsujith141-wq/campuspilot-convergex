import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

// The static prototype is the last-resort offline demo. It must stay byte-identical to the kit.
describe("offline prototype fallback", () => {
  for (const f of ["index.html", "styles.css", "app.js"]) {
    it(`/prototype/${f} is unchanged from the build kit`, () => {
      const hash = (p: string) => createHash("sha256").update(readFileSync(path.join(process.cwd(), p))).digest("hex");
      expect(hash(`prototype/${f}`)).toBe(hash(`CampusPilot_Build_Kit/prototype/${f}`));
    });
  }
});
