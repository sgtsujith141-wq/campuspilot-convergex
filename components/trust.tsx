"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, CircleCheck, CircleX } from "lucide-react";
import { formatIstClock, formatIstStamp } from "@/lib/core/time";
import type { Tone } from "@/lib/present";
import { Alert, Badge, Spinner, cx } from "./ui";
import { useWorkspace } from "./workspace";

// Fixed IDs of the second fictional profile's records (see lib/server/seed.ts). Knowing an ID
// is not access: the server decides, and the check below reports exactly what it returned.
const OTHER = { courseId: "oth_course_ns", missionId: "msn_other_demo" };

type Probe = { id: string; label: string; method: "GET" | "POST"; path: string; body?: unknown; expect: number };
type ProbeResult = Probe & { status: number; code: string; ms: number; pass: boolean };

function probes(): Probe[] {
  return [
    { id: "own", label: "Your own course record", method: "GET", path: "/api/courses/course_ns", expect: 200 },
    { id: "course", label: "Another student's attendance", method: "GET", path: `/api/courses/${OTHER.courseId}`, expect: 403 },
    { id: "mission", label: "Another student's decision", method: "GET", path: `/api/mission/${OTHER.missionId}`, expect: 403 },
    {
      id: "approve",
      label: "Approve another student's plan",
      method: "POST",
      path: `/api/mission/${OTHER.missionId}/approve`,
      body: { revision: 1, optionId: "partial", actionIds: ["act_0000000000000000"], challenge: "forged-challenge-0000", idempotencyKey: `probe-${Date.now()}` },
      expect: 403,
    },
  ];
}

const STATUS: Record<string, { tone: Tone; label: string }> = {
  enforced: { tone: "ok", label: "Enforced" },
  partial: { tone: "warn", label: "Partial" },
  demo: { tone: "neutral", label: "Demo only" },
  none: { tone: "bad", label: "Not implemented" },
};

type Report =
  | { available: false }
  | { available: true; startTime: number | null; numTotalTests: number; numPassedTests: number; numFailedTests: number; tests: { file: string; name: string; status: string }[] };

export function TrustCenter() {
  const { ws, refresh } = useWorkspace();
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch("/api/test-report", { cache: "no-store" })
      .then((r) => r.json())
      .then(setReport)
      .catch(() => setReport({ available: false }));
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    const out: ProbeResult[] = [];
    for (const p of probes()) {
      const t0 = performance.now();
      try {
        const res = await fetch(p.path, {
          method: p.method,
          cache: "no-store",
          headers: p.body ? { "content-type": "application/json" } : undefined,
          body: p.body ? JSON.stringify(p.body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        out.push({ ...p, status: res.status, code: data.error ?? (res.ok ? "OK" : ""), ms: Math.round(performance.now() - t0), pass: res.status === p.expect });
      } catch {
        out.push({ ...p, status: 0, code: "NO RESPONSE", ms: Math.round(performance.now() - t0), pass: false });
      }
    }
    setResults(out);
    setRanAt(new Date().toISOString());
    setRunning(false);
    await refresh();
  }, [refresh]);

  const allPass = results?.every((r) => r.pass);
  const shown = results ?? probes().map((p) => ({ ...p, status: 0, code: "", ms: 0, pass: false }));
  const securityTests = report && report.available ? report.tests.filter((t) => /backend|agents|registration/.test(t.file)) : [];

  const controls: { name: string; what: string; status: keyof typeof STATUS }[] = [
    { name: "Student record isolation", what: "Every request is scoped to the signed-in student by the server. Another student's record gets the same 403 as one that doesn't exist.", status: "enforced" },
    { name: "Authorized tools", what: "Each agent role has an allowlist and strict argument schemas. Identity is injected by the server, so no tool can be pointed at another student.", status: "enforced" },
    { name: "Local action approval", what: "Only the approval gateway creates tasks, pinned to a plan revision. Outdated approvals are refused; retries never duplicate or reinstate.", status: "enforced" },
    {
      name: "Local AI boundary",
      what: "The local model only chooses among six read-only tools. It never receives identifiers, cannot write anything, and its output is schema-validated; every number comes from the deterministic engine.",
      status: "enforced",
    },
    { name: "Request hygiene", what: "Changes must be same-origin JSON within a size cap; malformed IDs are refused before any lookup; denials are audited.", status: "enforced" },
    {
      name: "Untrusted content",
      what: "Event text is stored as data and never sent to the model. Hostile questions were tried against the real local model; the gateway kept every call scoped. Prompt injection is not solved in general.",
      status: "partial",
    },
    { name: "Source trust", what: "Records are versioned and labelled synthetic. The event listing and the attendance policy are unverified.", status: "partial" },
    {
      name: "Session",
      what: `Sample login for one fictional profile; httpOnly, SameSite=Strict cookie${ws.session.expiresAt ? `, expires ${formatIstStamp(ws.session.expiresAt)} IST` : ""}. Not a production identity system.`,
      status: "demo",
    },
    { name: "Institutional sign-in, rate limiting, VTOP", what: "Not built in this MVP.", status: "none" },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Security</h1>
          <p className="lede">What CampusPilot can access, what it can do, and how that is enforced.</p>
        </div>
      </header>

      <section className="panel" aria-labelledby="controls-title">
        <div className="panel-head">
          <div>
            <h2 id="controls-title">Permissions overview</h2>
            <div className="sub">Enforced on the server, outside any agent</div>
          </div>
        </div>
        <table className="controls">
          <thead>
            <tr>
              <th scope="col">Control</th>
              <th scope="col">What it means</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td className="what" data-dynamic={c.name === "Session" ? true : undefined}>
                  {c.what}
                </td>
                <td>
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="security-grid">
        <section className="panel" aria-labelledby="probe-title">
          <div className="panel-head">
            <div>
              <h2 id="probe-title">Live access check</h2>
              <div className="sub">Real requests from this browser with your session. The server decides.</div>
            </div>
          </div>
          <ul className="probe-list" data-testid="probe-results" data-state={results ? "done" : "idle"}>
            {shown.map((r) => (
              <li className="probe" key={r.id} data-pass={results ? String(r.pass) : undefined}>
                <div>
                  <div className="label">{r.label}</div>
                  <code>
                    {r.method} {r.path}
                  </code>
                </div>
                <div className={cx("resp", results ? (r.pass ? "pass" : "fail") : "idle")}>{results ? `${r.status} ${r.code}` : `expect ${r.expect}`}</div>
                {results && (
                  <small data-dynamic>
                    Expected {r.expect} · received {r.status} in {r.ms} ms · {r.pass ? "as expected" : "UNEXPECTED — treat isolation as unverified"}
                  </small>
                )}
              </li>
            ))}
          </ul>
          <div className="panel-foot">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {results && (
                <Alert tone={allPass ? "ok" : "bad"} role="status" dynamic>
                  {allPass
                    ? `Checked at ${formatIstClock(ranAt!)} IST: the server returned 403 for every cross-student request and 200 for your own record. No other student's data reached this browser.`
                    : "At least one response did not match. Treat student isolation as unverified until this is fixed."}
                </Alert>
              )}
              <div>
                <button className="btn btn-secondary" onClick={run} disabled={running} data-testid="run-probe">
                  {running ? (
                    <>
                      <Spinner /> Sending requests…
                    </>
                  ) : results ? (
                    "Run the check again"
                  ) : (
                    "Run access check"
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="audit-title">
          <div className="panel-head">
            <div>
              <h2 id="audit-title">Security events</h2>
              <div className="sub">Server audit log for your session</div>
            </div>
            <span data-dynamic>
              <Badge plain>Latest {ws.audit.length}</Badge>
            </span>
          </div>
          {ws.audit.length === 0 ? (
            <p className="panel-body muted text-sm">No events yet.</p>
          ) : (
            <ul className="audit" data-testid="audit" data-dynamic>
              {ws.audit.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <time dateTime={a.at}>{formatIstClock(a.at)}</time>
                  <code>
                    {a.action}
                    {a.target ? ` → ${a.target}` : ""}
                  </code>
                  {a.outcome === "ok" ? <Badge tone="ok">Allowed</Badge> : <Badge tone="bad">Denied {a.outcome.split(":")[1]}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: "1.25rem" }} aria-labelledby="tests-title">
        <div className="panel-head">
          <div>
            <h2 id="tests-title">Test evidence</h2>
            <div className="sub" data-dynamic>
              {report?.available
                ? `Last recorded run of npm run test:report${report.startTime ? ` · ${formatIstStamp(new Date(report.startTime).toISOString())} IST` : ""}`
                : "Read from the stored report — nothing is generated here"}
            </div>
          </div>
          {report?.available ? (
            <span data-dynamic>
              <Badge tone={report.numFailedTests === 0 ? "ok" : "bad"}>
                {report.numPassedTests}/{report.numTotalTests} passed
              </Badge>
            </span>
          ) : (
            <Badge>No recorded run</Badge>
          )}
        </div>
        {report?.available ? (
          <div style={{ padding: "0 1.25rem" }}>
            <details className="disclosure" style={{ borderTop: 0 }}>
              <summary>
                <ChevronRight size={14} aria-hidden="true" /> <span data-dynamic>Show {securityTests.length} security and integrity tests</span>
              </summary>
              <ul className="test-list" style={{ padding: "0 0 1rem" }}>
                {securityTests.map((t) => (
                  <li className={t.status === "passed" ? "" : "failed"} key={`${t.file}-${t.name}`}>
                    {t.status === "passed" ? <CircleCheck size={14} aria-label="passed" /> : <CircleX size={14} aria-label="failed" />}
                    <span>{t.name}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : (
          <p className="panel-body text-sm muted">
            Run <code>npm run test:report</code> to record a run.
          </p>
        )}
      </section>

      <section className="panel" style={{ marginTop: "1.25rem" }} aria-labelledby="claims-title">
        <div className="panel-head">
          <h2 id="claims-title">What is real</h2>
        </div>
        <div className="claims">
          <div>
            <h3>Implemented and verified</h3>
            <ul>
              <li>Attendance projections (74.2 / 77.4 / 80.6%)</li>
              <li>Per-student isolation over real HTTP</li>
              <li>Revision-pinned, idempotent approvals</li>
              <li>Automatic re-planning on source change</li>
              <li>Scoped agent tools with recorded traces</li>
              <li>Local model (llama3.2:1b) routing questions to tools</li>
            </ul>
          </div>
          <div>
            <h3>Implemented, not independently verified</h3>
            <ul>
              <li>Security headers in a real deployment</li>
              <li>Browsers other than Chromium</li>
              <li>Accessibility beyond automated checks</li>
            </ul>
          </div>
          <div>
            <h3>Simulated</h3>
            <ul>
              <li>Student, event, records and policy</li>
              <li>The deadline change (controlled demo)</li>
              <li>Sign-in (sample login)</li>
            </ul>
          </div>
          <div>
            <h3>Not implemented</h3>
            <ul>
              <li>VTOP or any university system</li>
              <li>Cloud AI models; model-written answers</li>
              <li>On-duty approval or eligibility checks</li>
              <li>Institutional SSO, rate limiting</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
