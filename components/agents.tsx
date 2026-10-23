"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, ListTree } from "lucide-react";
import { formatIstClock, formatIstStamp } from "@/lib/core/time";
import { RUN_KIND_LABEL, stepLabel } from "@/lib/present";
import type { TraceEventView } from "@/lib/views";
import { Alert, Badge, EmptyState, cx } from "./ui";
import { useWorkspace } from "./workspace";

const ROLE_LABEL: Record<string, string> = {
  academic: "Academic specialist",
  opportunity: "Opportunity specialist",
  evaluator: "Constraint evaluator (deterministic)",
  planner: "Planning specialist",
};

function duration(ms: number | null) {
  if (ms === null) return "—";
  return ms < 1 ? `${ms.toFixed(2)} ms` : `${ms.toFixed(1)} ms`;
}

function Step({ e, showTime }: { e: TraceEventView; showTime: boolean }) {
  const dot = e.status !== "succeeded" ? "bad" : e.tool ? undefined : "note";
  return (
    <li className="step">
      <time dateTime={e.startedAt}>{showTime ? formatIstClock(e.startedAt) : ""}</time>
      <div className="rail-line" aria-hidden="true">
        <span className={cx("dot", dot)} />
      </div>
      <div className="step-body">
        <div>
          <strong>{stepLabel(e)}</strong>
          <span className="actor">{e.actor}</span>
        </div>
        <p>{e.summary}</p>
        <details>
          <summary>
            <ChevronRight size={12} aria-hidden="true" /> Inspect
          </summary>
          <dl className="inspect">
            <dt>Tool</dt>
            <dd>{e.tool ?? "— (checkpoint, no tool call)"}</dd>
            <dt>Arguments</dt>
            <dd>{e.args && Object.keys(e.args).length ? JSON.stringify(e.args) : "none"}</dd>
            <dt>Evidence</dt>
            <dd>{e.evidenceRefs.length ? e.evidenceRefs.join(", ") : "none"}</dd>
            <dt>Status</dt>
            <dd>{e.status}</dd>
            <dt>Duration</dt>
            <dd>{e.tool ? duration(e.durationMs) : "n/a"}</dd>
            <dt>Mode</dt>
            <dd>{e.mode}</dd>
            <dt>Recorded</dt>
            <dd>{e.startedAt}</dd>
            {e.error && (
              <>
                <dt>Error</dt>
                <dd>{e.error}</dd>
              </>
            )}
          </dl>
        </details>
      </div>
    </li>
  );
}

export function AgentActivity() {
  const { ws } = useWorkspace();
  const [picked, setPicked] = useState<string | null>(null);
  const runs = ws.runs;
  const run = runs.find((r) => r.id === picked) ?? runs[0];
  const toolCalls = run?.events.filter((e) => e.tool).length ?? 0;
  const total = run && run.completedAt ? Date.parse(run.completedAt) - Date.parse(run.startedAt) : null;
  const roles = Array.from(new Set(ws.agent.tools.map((t) => t.role)));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="lede">How CampusPilot reached your current plan. Every entry below was recorded by the server while the workflow ran.</p>
        </div>
        <div className="actions">
          <Badge tone="warn">Deterministic agent workflow · no model</Badge>
        </div>
      </header>

      {!run ? (
        <section className="panel">
          <EmptyState
            icon={<ListTree size={22} aria-hidden="true" />}
            title="No activity yet"
            action={
              <Link className="btn btn-primary" href="/decisions">
                Evaluate a decision
              </Link>
            }
          >
            Evaluate a decision and each step the workflow takes will be recorded here.
          </EmptyState>
        </section>
      ) : (
        <div className="activity-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", minWidth: 0 }}>
            <section className="panel" aria-labelledby="runs-title">
              <div className="panel-head">
                <h2 id="runs-title">Runs</h2>
                <Badge plain>{runs.length}</Badge>
              </div>
              <ul className="run-list">
                {runs.map((r) => (
                  <li key={r.id}>
                    <button className="run-btn" aria-current={r.id === run.id ? "true" : undefined} onClick={() => setPicked(r.id)} data-kind={r.kind}>
                      <strong>{RUN_KIND_LABEL[r.kind]}</strong>
                      <span data-dynamic>
                        Revision {r.revision} · {formatIstStamp(r.startedAt)} IST
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel" aria-labelledby="scopes-title">
              <div className="panel-head">
                <div>
                  <h2 id="scopes-title">Tool scopes</h2>
                  <div className="sub">What each role is allowed to call</div>
                </div>
              </div>
              <ul className="scope-list">
                {roles.map((role) => (
                  <li key={role}>
                    <strong>{ROLE_LABEL[role] ?? role}</strong>
                    <div className="tools">
                      {ws.agent.tools
                        .filter((t) => t.role === role)
                        .map((t) => (
                          <span className="tool" key={t.name} title={t.description}>
                            {t.name}
                          </span>
                        ))}
                    </div>
                  </li>
                ))}
                <li className="text-sm muted">Identity comes from your session, never from a tool argument. No agent can execute actions; only your approval can.</li>
              </ul>
            </section>
          </div>

          <section className="panel" aria-labelledby="run-title" data-testid="run-detail">
            <div className="panel-head">
              <div>
                <h2 id="run-title">{RUN_KIND_LABEL[run.kind]}</h2>
                <div className="sub">{run.summary}</div>
              </div>
            </div>
            <dl className="run-summary">
              <div>
                <dt>Mode</dt>
                <dd>Deterministic</dd>
              </div>
              <div>
                <dt>Tool calls</dt>
                <dd>{toolCalls}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd data-dynamic>{total === null ? "—" : `${total} ms`}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>None</dd>
              </div>
            </dl>
            <ol className="steps">
              {run.events.map((e, i) => (
                <Step key={e.seq} e={e} showTime={i === 0 || formatIstClock(e.startedAt) !== formatIstClock(run.events[i - 1].startedAt)} />
              ))}
            </ol>
            <div style={{ padding: "0 1.25rem" }}>
              <details className="disclosure">
                <summary>
                  <ChevronRight size={14} aria-hidden="true" /> Run inspector
                </summary>
                <dl className="tech">
                  <dt>Run ID</dt>
                  <dd>{run.id}</dd>
                  <dt>Kind</dt>
                  <dd>{run.kind}</dd>
                  <dt>Execution mode</dt>
                  <dd>{run.mode}</dd>
                  <dt>Model</dt>
                  <dd>{run.model ?? "none — no language model was called"}</dd>
                  <dt>Plan revision</dt>
                  <dd>{run.revision}</dd>
                  <dt>Started</dt>
                  <dd>{run.startedAt}</dd>
                  <dt>Completed</dt>
                  <dd>{run.completedAt ?? "—"}</dd>
                  <dt>Status</dt>
                  <dd>{run.status}</dd>
                </dl>
              </details>
            </div>
          </section>
        </div>
      )}

      <div style={{ marginTop: "1.25rem" }}>
        <Alert tone="info">
          These steps are a fixed, deterministic sequence of scoped tool calls — not autonomous model reasoning. A run would only be labelled “Live AI agent” if the server recorded real model calls,
          and no model is configured in this build.
        </Alert>
      </div>
    </div>
  );
}
