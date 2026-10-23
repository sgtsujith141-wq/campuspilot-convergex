"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Database, ListChecks } from "lucide-react";
import { formatPercent } from "@/lib/core/attendance";
import { formatDateRange, formatIst, formatIstDay, formatIstStamp, formatIstTime, toMs } from "@/lib/core/time";
import {
  assignmentMoved,
  attentionItems,
  dueDuringEvent,
  groupByDay,
  missionState,
  registrationFor,
  registrationText,
  summaryLine,
  timelineEntries,
  timelineRange,
} from "@/lib/present";
import type { WorkspaceSnapshot } from "@/lib/views";
import { Badge, Dialog, EmptyState, Meter, cx } from "./ui";
import { useWorkspace } from "./workspace";

function greeting(asOf: string) {
  const h = Number(asOf.slice(11, 13));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function DataSourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ws } = useWorkspace();
  return (
    <Dialog open={open} onClose={onClose} title="Data sources" description="Every record is synthetic and versioned. Plans pin the versions they were computed from.">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Record</th>
              <th>Source</th>
              <th>Version</th>
              <th>As of (IST)</th>
            </tr>
          </thead>
          <tbody>
            {ws.sources.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.label}
                  <br />
                  <code>{s.id}</code>
                </td>
                <td>
                  {s.kind.replace(/_/g, " ")} · {s.verification}
                </td>
                <td className="num">v{s.version}</td>
                <td>{formatIstStamp(s.retrievedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>VTOP</strong> is not connected; CampusPilot never asks for university credentials. <strong>No language model</strong> is configured — agents run as a deterministic workflow.
        The {ws.policy?.threshold}% attendance threshold is a sample configuration, not an official regulation.
      </p>
    </Dialog>
  );
}

/** The course that participation affects most (lowest projection under full attendance). */
function constraintRange(ws: WorkspaceSnapshot) {
  const m = ws.mission;
  if (!m) return null;
  const full = m.result.options.find((o) => o.id === "full") ?? m.result.options[0];
  const course = [...full.projections].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];
  const values = m.result.options.map((o) => o.projections.find((p) => p.courseId === course.courseId)?.percent ?? null).filter((v): v is number => v !== null);
  return { name: course.name, min: Math.min(...values), max: Math.max(...values) };
}

const STATE_BADGE = {
  none: { tone: "neutral", label: "Not evaluated" },
  awaiting: { tone: "accent", label: "Recommendation ready" },
  approved: { tone: "ok", label: "Plan approved" },
  needs_review: { tone: "warn", label: "Changed — needs review" },
} as const;

const STATE_CTA = {
  none: { label: "Evaluate options", note: "Reads your synthetic academic records and compares three choices. Nothing is submitted anywhere." },
  awaiting: { label: "Review recommendation", note: "Three options are ready to compare. Nothing happens until you approve a plan." },
  approved: { label: "Open your plan", note: "Approved in CampusPilot only — on-duty permission and event eligibility are still unverified." },
  needs_review: { label: "Review what changed", note: "A source record changed after you approved. Your earlier approval no longer applies." },
} as const;

export function OverviewView() {
  const { ws } = useWorkspace();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const first = ws.student.name.split(" ")[0];
  const state = missionState(ws.mission);
  const items = attentionItems(ws);
  const entries = timelineEntries(ws);
  const groups = groupByDay(entries);
  const range = timelineRange(entries);
  const reg = registrationText(registrationFor(ws));
  const impact = constraintRange(ws);
  const lowest = [...ws.courses].sort((a, b) => (a.currentPercent ?? 0) - (b.currentPercent ?? 0))[0];
  const threshold = ws.policy?.threshold ?? null;
  const tasks = ws.tasks.filter((t) => t.status !== "superseded");
  const moved = assignmentMoved(ws);
  const during = dueDuringEvent(ws);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            {greeting(ws.scenario.asOf)}, {first}
          </h1>
          <p className="lede" data-testid="summary">
            {summaryLine(ws)}
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => setSourcesOpen(true)}>
            <Database size={15} aria-hidden="true" /> Data sources
          </button>
        </div>
      </header>

      <div className="home-top">
        <section className="panel decision-card" aria-labelledby="next-decision">
          <div className="kicker">
            <span>
              Next decision · {ws.opportunity.name} · {formatDateRange(ws.opportunity.start, ws.opportunity.end)}
            </span>
            <Badge tone={STATE_BADGE[state].tone}>{STATE_BADGE[state].label}</Badge>
          </div>
          <h2 id="next-decision">Can I attend {ws.opportunity.name}?</h2>
          <dl className="facts">
            <div className="fact">
              <dt>Attendance impact</dt>
              <dd className="num">
                {impact ? `${impact.name} ${impact.min.toFixed(1)}–${impact.max.toFixed(1)}%` : `${lowest.name} now ${formatPercent(lowest.currentPercent)}`}
                <small>{impact ? `Projected across the three options · sample ${threshold}% rule` : "Evaluate to see the effect of each option"}</small>
              </dd>
            </div>
            <div className="fact">
              <dt>Deadline</dt>
              <dd>
                {ws.assignment.name}
                <small>
                  Due {formatIst(ws.assignment.dueAt)}
                  {during ? " — during the event" : moved ? " — moved earlier" : ""}
                </small>
              </dd>
            </div>
            <div className="fact">
              <dt>Registration</dt>
              <dd>
                {reg.label}
                <small>From a curated listing, not verified</small>
              </dd>
            </div>
            <div className="fact">
              <dt>Still to verify</dt>
              <dd>
                Eligibility and on-duty approval
                <small>Only the organisers and your institution can confirm these</small>
              </dd>
            </div>
          </dl>
          <div className="cta">
            <p>{STATE_CTA[state].note}</p>
            <Link className="btn btn-primary btn-lg" href={state === "needs_review" ? "/decisions#plan-update" : "/decisions"} data-testid="home-cta">
              {STATE_CTA[state].label} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="panel" aria-labelledby="attention-title">
          <div className="panel-head">
            <h2 id="attention-title">Needs attention</h2>
            <Badge plain>{items.length}</Badge>
          </div>
          {items.length === 0 ? (
            <EmptyState title="Nothing needs attention">Changes to your records will show up here.</EmptyState>
          ) : (
            <ul className="attention-list" data-testid="attention">
              {items.map((i) => (
                <li key={i.id}>
                  <Link href={i.href}>
                    <span className={cx("marker", i.tone)} aria-hidden="true" />
                    <span>
                      <strong>{i.title}</strong>
                      <span>{i.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="home-grid">
        <section className="panel" aria-labelledby="upcoming-title">
          <div className="panel-head">
            <h2 id="upcoming-title">Upcoming</h2>
            {range && <span className="muted text-sm">{range}</span>}
          </div>
          <ol className="timeline">
            {groups.map((g) => {
              const d = formatIstDay(g.at);
              return (
                <li className="day" key={g.day}>
                  <div className="day-label">
                    <strong>{d.day}</strong>
                    <span>{d.month}</span>
                  </div>
                  <div className="day-entries">
                    {g.entries.map((e) => (
                      <div className={cx("entry", e.tone)} key={e.id}>
                        <time dateTime={e.at}>{formatIstTime(e.at)}</time>
                        <div>
                          <strong>
                            {e.title} {e.changed && <span className="changed">· changed</span>}
                          </strong>
                          <span>{e.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="panel" aria-labelledby="attendance-title">
          <div className="panel-head">
            <div>
              <h2 id="attendance-title">Attendance</h2>
              <div className="sub">Synthetic records · as of {formatIstStamp(ws.scenario.asOf)}</div>
            </div>
          </div>
          <table className="course-table">
            <colgroup>
              <col />
              <col className="c-att" />
              <col className="c-now" />
              <col className="c-bar" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col" className="r">
                  Attended
                </th>
                <th scope="col" className="r">
                  Now
                </th>
                <th scope="col">
                  <span className="sr-only">Progress against the sample threshold</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ws.courses.map((c) => {
                const near = threshold !== null && (c.currentPercent ?? 0) < threshold + 5;
                return (
                  <tr key={c.id}>
                    <td className="course">
                      <strong>{c.name}</strong>
                      <span>{c.code}</span>
                    </td>
                    <td className="r num">
                      {c.attended}/{c.total}
                    </td>
                    <td className="r pct">{formatPercent(c.currentPercent)}</td>
                    <td>
                      <Meter value={c.currentPercent} threshold={threshold} tone={near ? "warn" : undefined} label={`${c.name} attendance ${formatPercent(c.currentPercent)}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="panel-foot text-sm muted">The mark on each bar is the sample {threshold}% threshold — illustrative, not an official regulation.</div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: "1.25rem" }} aria-labelledby="tasks-title">
        <div className="panel-head">
          <div>
            <h2 id="tasks-title">Your tasks</h2>
            <div className="sub">Created on the server only after you approve a plan</div>
          </div>
          {tasks.length > 0 && <Badge plain>{tasks.length}</Badge>}
        </div>
        {tasks.length === 0 ? (
          <EmptyState icon={<ListChecks size={22} aria-hidden="true" />} title="No tasks yet">
            Approve a plan in Decisions and its tasks appear here.
          </EmptyState>
        ) : (
          <TaskList />
        )}
      </section>

      <DataSourcesDialog open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </div>
  );
}

export function TaskList() {
  const { ws } = useWorkspace();
  const tasks = ws.tasks.filter((t) => t.status !== "superseded").sort((a, b) => toMs(a.blockStart ?? a.dueAt ?? a.createdAt) - toMs(b.blockStart ?? b.dueAt ?? b.createdAt));
  return (
    <ul className="task-list" data-testid="task-list">
      {tasks.map((t) => (
        <li className="task" key={t.id}>
          <span className={cx("state", t.status === "active" ? "on" : "review")} aria-hidden="true">
            {t.status === "active" ? <Check size={11} strokeWidth={3} /> : null}
          </span>
          <div className="body">
            <strong>{t.title}</strong>
            <span className="when">
              {t.blockStart && t.blockEnd ? `Planned ${formatIst(t.blockStart)}` : t.dueAt ? `Due ${formatIst(t.dueAt)}` : "No date"} · from plan revision {t.originRevision}
            </span>
          </div>
          {t.status === "active" ? <Badge tone="ok">Current</Badge> : <Badge tone="warn">Needs review</Badge>}
        </li>
      ))}
    </ul>
  );
}
