"use client";

import Link from "next/link";
import { useState } from "react";
import { Asterisk, BookOpen, Calculator, CircleX, Info, ListChecks, Radar, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { formatIstClock, formatIstStamp } from "@/lib/core/time";
import type { RunView, TraceEventView } from "@/lib/views";
import { useWorkspace } from "./workspace";

const ACTOR_ICON: Record<string, typeof Workflow> = {
  "Personal orchestrator": Workflow,
  "Source watcher": Radar,
  "Academic specialist": BookOpen,
  "Opportunity specialist": Sparkles,
  "Constraint evaluator": Calculator,
  "Planning specialist": ListChecks,
  "Permission checkpoint": ShieldCheck,
};

const ROLE_LABEL: Record<string, string> = {
  academic: "Academic specialist",
  opportunity: "Opportunity specialist",
  evaluator: "Constraint evaluator (deterministic)",
  planner: "Planning specialist",
};

const KIND_LABEL: Record<RunView["kind"], string> = { evaluate: "Initial evaluation", replan: "Source-triggered replan", recalculate: "Manual re-run" };

function argsLabel(e: TraceEventView) {
  if (!e.args || Object.keys(e.args).length === 0) return "()";
  return `(${Object.entries(e.args)
    .map(([k, v]) => `${k}: "${v}"`)
    .join(", ")})`;
}

function durationLabel(ms: number | null) {
  if (ms === null) return "";
  return ms < 1 ? `${ms.toFixed(2)} ms` : `${ms.toFixed(1)} ms`;
}

export function AgentActivity() {
  const { ws } = useWorkspace();
  const [picked, setPicked] = useState<string | null>(null);
  const runs = ws.runs;
  const run = runs.find((r) => r.id === picked) ?? runs[0];
  const total = run && run.completedAt ? Date.parse(run.completedAt) - Date.parse(run.startedAt) : null;
  const toolCalls = run?.events.filter((e) => e.tool).length ?? 0;
  const roles = Array.from(new Set(ws.agent.tools.map((t) => t.role)));

  return (
    <section className="view">
      <div className="page-header">
        <div>
          <div className="overline">AI orchestration</div>
          <h1>
            Agent activity <Workflow size={26} strokeWidth={2} />
          </h1>
          <p>Every step below was recorded by the server while it executed scoped tools. Nothing on this page is pre-scripted.</p>
        </div>
        <span className="pill pill-demo">OFFLINE GUIDED WORKFLOW</span>
      </div>

      {!run ? (
        <div className="panel">
          <div className="empty-state">
            <Workflow size={28} color="#8f89ee" />
            <h3>No agent runs yet</h3>
            <p>Ask CampusPilot in the Decision studio; the run and every tool call will appear here.</p>
            <Link className="btn btn-primary" href="/decisions">
              Go to Decision studio
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="activity-intro">
            <div className="activity-illustration">
              <Asterisk size={40} strokeWidth={1.6} />
            </div>
            <div>
              <span className="eyebrow">Mission trace · {KIND_LABEL[run.kind]}</span>
              <h2>{ws.opportunity.name} participation feasibility</h2>
              <p>
                Mode <strong>deterministic</strong>: the orchestrator called these tools in a fixed order and the evaluator computed every number. No language model was called in
                this run — none is configured — so nothing here is presented as model reasoning.
              </p>
              <div className="run-meta">
                <span className="chip mono">{run.id}</span>
                <span className="chip">Revision {run.revision}</span>
                <span className="chip">Started {formatIstStamp(run.startedAt)} IST</span>
                <span className="chip">{toolCalls} tool calls</span>
                {total !== null && <span className="chip">{total} ms total</span>}
                <span className="chip">mode = {run.mode}</span>
                <span className="chip">model = none</span>
              </div>
            </div>
          </div>

          {runs.length > 1 && (
            <div className="run-tabs" role="tablist" aria-label="Agent runs">
              {runs.map((r) => (
                <button key={r.id} role="tab" aria-selected={r.id === run.id} className={`run-tab ${r.id === run.id ? "active" : ""}`} onClick={() => setPicked(r.id)}>
                  {KIND_LABEL[r.kind]} · r{r.revision}
                  <small>{formatIstClock(r.startedAt)} IST</small>
                </button>
              ))}
            </div>
          )}

          <div className="activity-layout">
            <div className="activity-list">
              <div className="info-bar" style={{ marginTop: 0 }}>
                <Info size={16} />
                <span>{run.summary}</span>
              </div>
              {run.events.map((e) => {
                const Icon = ACTOR_ICON[e.actor] ?? Workflow;
                const state = e.status === "succeeded" ? "" : e.status;
                return (
                  <div className={`activity-step ${e.tool ? "" : "note"} ${state}`} key={e.seq}>
                    <div className="agent-symbol">{e.status === "succeeded" ? <Icon size={19} /> : <CircleX size={19} />}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="eyebrow">
                        Step {String(e.seq).padStart(2, "0")} · {e.actor}
                      </div>
                      <h4>
                        {e.tool ? (
                          <code>
                            {e.tool}
                            {argsLabel(e)}
                          </code>
                        ) : (
                          e.actor
                        )}
                      </h4>
                      <p>{e.summary}</p>
                      {e.evidenceRefs.length > 0 && (
                        <div className="step-meta">
                          {e.evidenceRefs.map((r) => (
                            <span className="chip mono" key={r}>
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`step-state ${state}`}>
                      <strong>{e.status.toUpperCase()}</strong>
                      <small>{e.tool ? durationLabel(e.durationMs) : "checkpoint"}</small>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="panel scope-card">
              <span className="subhead">Least privilege</span>
              <h3 style={{ margin: "7px 0 14px", fontSize: 16 }}>Agent tool scopes</h3>
              {roles.map((role) => (
                <div key={role}>
                  <h4>{ROLE_LABEL[role] ?? role}</h4>
                  <div className="tools">
                    {ws.agent.tools
                      .filter((t) => t.role === role)
                      .map((t) => (
                        <span className="chip mono" key={t.name} title={t.description}>
                          {t.name}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
              <p>
                Identity is injected by the server from your session; no tool accepts a student ID. Execution (<code>commit_approved_task</code>) is not available to any agent — only
                the approval gateway can run it, after your explicit approval.
              </p>
            </div>
          </div>
        </>
      )}

      <div className="info-bar">
        <Info size={16} />
        <span>
          Live model orchestration is not enabled in this build. If it is added, a run will be labelled “Live agent run” only when the server recorded real model calls; deterministic runs
          keep this “Offline guided workflow” label.
        </span>
      </div>
    </section>
  );
}
