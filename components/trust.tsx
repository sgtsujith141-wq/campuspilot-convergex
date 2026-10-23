"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, CircleX, FlaskConical, Fingerprint, KeyRound, LoaderCircle, Lock, ScanSearch, Server, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatIstClock, formatIstStamp } from "@/lib/core/time";
import { useWorkspace } from "./workspace";

// Fixed IDs of the second fictional profile's records (see lib/server/seed.ts). Knowing an ID
// is not access: the server decides, and these probes show what it actually returns.
const OTHER = { courseId: "oth_course_ns", missionId: "msn_other_demo" };

type Probe = { id: string; label: string; method: "GET" | "POST"; path: string; body?: unknown; expect: number };
type ProbeResult = Probe & { status: number; code: string; ms: number; pass: boolean };

function probes(): Probe[] {
  return [
    { id: "own", label: "Control — read your own course", method: "GET", path: "/api/courses/course_ns", expect: 200 },
    { id: "course", label: "Read Student B's attendance record", method: "GET", path: `/api/courses/${OTHER.courseId}`, expect: 403 },
    { id: "mission", label: "Read Student B's mission plan", method: "GET", path: `/api/mission/${OTHER.missionId}`, expect: 403 },
    {
      id: "approve",
      label: "Approve actions on Student B's plan",
      method: "POST",
      path: `/api/mission/${OTHER.missionId}/approve`,
      body: { revision: 1, optionId: "partial", actionIds: ["act_0000000000000000"], challenge: "forged-challenge-0000", idempotencyKey: `probe-${Date.now()}` },
      expect: 403,
    },
  ];
}

type Report = { available: false } | { available: true; startTime: number | null; numTotalTests: number; numPassedTests: number; numFailedTests: number; tests: { file: string; name: string; status: string }[] };

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

  const runProbes = useCallback(async () => {
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
        out.push({ ...p, status: 0, code: "NETWORK", ms: Math.round(performance.now() - t0), pass: false });
      }
    }
    setResults(out);
    setRanAt(new Date().toISOString());
    setRunning(false);
    await refresh();
  }, [refresh]);

  const allPass = results?.every((r) => r.pass);
  const securityTests = report && report.available ? report.tests.filter((t) => /backend|agents/.test(t.file)) : [];

  return (
    <section className="view">
      <div className="page-header">
        <div>
          <div className="overline">Built-in cybersecurity</div>
          <h1>
            Trust center <ShieldCheck size={26} strokeWidth={2} />
          </h1>
          <p>What your agent may know, what it may do, and how authorization is enforced.</p>
        </div>
        <span className="tag tag-green">Server-enforced · covered by automated tests</span>
      </div>

      <div className="trust-layout">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="subhead">Student ownership</span>
              <h3>Access boundaries</h3>
            </div>
          </div>
          <div className="rule">
            <div className="rule-icon">
              <Fingerprint size={16} />
            </div>
            <div>
              <strong>Student-scoped records</strong>
              <p>Every API route takes the student from the server session, never from the request. Foreign and unknown IDs both get the same 403, so responses do not reveal what exists.</p>
            </div>
            <span className="tag tag-green tag-upper">Enforced</span>
          </div>
          <div className="rule">
            <div className="rule-icon">
              <KeyRound size={16} />
            </div>
            <div>
              <strong>Human approval for every write</strong>
              <p>Only the approval gateway executes actions — local tasks only — pinned to the plan revision with a per-revision consent challenge. Stale approvals get 409; repeats never duplicate.</p>
            </div>
            <span className="tag tag-green tag-upper">Enforced</span>
          </div>
          <div className="rule">
            <div className="rule-icon">
              <Lock size={16} />
            </div>
            <div>
              <strong>Least-privilege agent tools</strong>
              <p>Each specialist has an allowlist and strict argument schemas; a smuggled student ID is rejected. Execution tools are not exposed to agents at all.</p>
            </div>
            <span className="tag tag-green tag-upper">Enforced</span>
          </div>
          <div className="rule">
            <div className="rule-icon">
              <ScanSearch size={16} />
            </div>
            <div>
              <strong>Retrieved text is untrusted</strong>
              <p>Event descriptions are stored as quarantined data and never routed into tool selection. Tested with a hostile notice against the deterministic workflow; untested against a live model (none is configured).</p>
            </div>
            <span className="tag tag-amber tag-upper">Partial</span>
          </div>
          <div className="rule">
            <div className="rule-icon">
              <Server size={16} />
            </div>
            <div>
              <strong>Sample login, not production identity</strong>
              <p>The demo session is issued for one fictional profile and accepts no identity input (httpOnly, SameSite=Strict, hashed at rest). Real deployment needs institutional SSO.</p>
            </div>
            <span className="tag tag-upper">Demo</span>
          </div>
        </div>

        <div className="panel security-test">
          <span className="subhead">Live authorization probe</span>
          <h3>Try a prohibited access request</h3>
          <p>Sends real HTTP requests from this browser with Maya&apos;s session cookie to records owned by a second fictional profile. The server decides; this panel only reports what came back.</p>
          <div className="test-target">
            <span>Requester</span>
            <strong>Maya Rao · server session</strong>
          </div>
          <div className="test-target">
            <span>Target</span>
            <strong>Test Student B (fictional) · {OTHER.courseId}</strong>
          </div>
          <button className="btn-danger" onClick={runProbes} disabled={running} data-testid="run-probe">
            {running ? (
              <>
                <LoaderCircle size={13} className="spin" /> Sending requests…
              </>
            ) : results ? (
              "Run the probe again ↗"
            ) : (
              "Test unauthorized access ↗"
            )}
          </button>
          {results && (
            <div className="probe-results" data-testid="probe-results">
              {results.map((r) => (
                <div className={`probe ${r.pass ? "pass" : "fail"}`} key={r.id}>
                  <div>
                    <div className="label">{r.label}</div>
                    <code>
                      {r.method} {r.path}
                    </code>
                  </div>
                  <div className="status">
                    {r.status} {r.code}
                  </div>
                  <small>
                    Expected {r.expect} · observed {r.status} in {r.ms} ms · {r.pass ? "matches expectation" : "DOES NOT MATCH — investigate"}
                  </small>
                </div>
              ))}
              <div className={allPass ? "inline-success" : "inline-warn"}>
                {allPass ? <CircleCheck size={15} /> : <TriangleAlert size={15} />}
                <span>
                  {allPass
                    ? `Observed at ${formatIstClock(ranAt!)} IST: the server returned 403 for every cross-student request and 200 for your own record. No Student B data reached this browser.`
                    : "At least one response did not match the expected status. Treat isolation as unverified until this is fixed."}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="subhead">Server audit log · your session</span>
              <h3>Recent decisions by the server</h3>
            </div>
            <span className="tag">Latest {ws.audit.length}</span>
          </div>
          {ws.audit.length === 0 && <p className="small-note">No audited actions yet.</p>}
          {ws.audit.map((a, i) => (
            <div className="audit-row" key={`${a.at}-${i}`}>
              <time>{formatIstClock(a.at)}</time>
              <code>
                {a.action}
                {a.target ? ` → ${a.target}` : ""}
              </code>
              <span className={a.outcome === "ok" ? "outcome-ok" : "outcome-denied"}>{a.outcome === "ok" ? "OK" : a.outcome.replace("denied:", "DENIED ")}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="subhead">Automated tests · last recorded run</span>
              <h3>Security and integrity suite</h3>
            </div>
            {report?.available ? (
              <span className={`tag ${report.numFailedTests === 0 ? "tag-green" : "tag-red"}`}>
                <FlaskConical size={12} /> {report.numPassedTests}/{report.numTotalTests} passed
              </span>
            ) : (
              <span className="tag">No recorded run</span>
            )}
          </div>
          {report?.available ? (
            <>
              <p className="small-note" style={{ margin: 0 }}>
                Recorded by <code>npm run test:report</code>
                {report.startTime ? ` on ${formatIstStamp(new Date(report.startTime).toISOString())} IST` : ""}. Route handlers are exercised with real sessions against a fresh SQLite
                database; results are read from the stored report, not generated here.
              </p>
              <div className="test-list">
                {securityTests.map((t) => (
                  <div className={`test-item ${t.status === "passed" ? "" : "failed"}`} key={`${t.file}-${t.name}`}>
                    {t.status === "passed" ? <CircleCheck size={13} /> : <CircleX size={13} />}
                    <span>{t.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="small-note">
              Run <code>npm run test:report</code> to record a run; this panel only shows stored results.
            </p>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 15 }}>
        <div className="panel-heading">
          <div>
            <span className="subhead">For judges</span>
            <h3>What we can honestly claim today</h3>
          </div>
        </div>
        <div className="claims">
          <div>
            <h4>
              <CircleCheck size={14} color="#18896e" /> Built and tested
            </h4>
            <ul>
              <li>Deterministic attendance engine (74.2 / 77.4 / 80.6%)</li>
              <li>Server sessions with per-student isolation (403)</li>
              <li>Revision-pinned approvals: 409 stale, idempotent</li>
              <li>Source change → automatic replan + approval invalidation</li>
              <li>Scoped agent tools with real execution traces</li>
            </ul>
          </div>
          <div>
            <h4>
              <TriangleAlert size={14} color="#c88434" /> Synthetic by design
            </h4>
            <ul>
              <li>Maya Rao and Student B are fictional</li>
              <li>CyberForge Sprint is an invented event</li>
              <li>Academic records come from a local simulator</li>
              <li>The {ws.policy?.threshold}% threshold is a sample policy</li>
            </ul>
          </div>
          <div>
            <h4>
              <CircleX size={14} color="#cf5262" /> Not built
            </h4>
            <ul>
              <li>VTOP or any university-system integration</li>
              <li>Live LLM orchestration (no model configured)</li>
              <li>Real on-duty approval or eligibility checks</li>
              <li>Production identity (SSO) and deployment</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
