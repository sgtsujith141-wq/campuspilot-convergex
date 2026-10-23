"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Asterisk, CalendarClock, Check, Clock, Database, FileText, Gauge, ListChecks, Sparkles } from "lucide-react";
import { formatPercent } from "@/lib/core/attendance";
import { formatIst, formatIstDay, formatIstStamp, formatIstTime } from "@/lib/core/time";
import { Modal, useWorkspace } from "./workspace";

const greeting = (asOf: string) => {
  const h = Number(asOf.slice(11, 13));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export function DataSourcesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ws } = useWorkspace();
  return (
    <Modal open={open} onClose={onClose} eyebrow="Transparency" title="Connected sources">
      <p>Every record below is synthetic and versioned. Plans pin the version they were computed from.</p>
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
                {s.kind.replace(/_/g, " ")}
                <br />
                <span className="tag tag-amber">{s.verification}</span>
              </td>
              <td>v{s.version}</td>
              <td>{formatIstStamp(s.retrievedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>VTOP:</strong> not connected. No university login, password or private record is requested or stored.
        <br />
        <strong>Language model:</strong> none configured. Agents run as a deterministic, server-side workflow over scoped tools.
        <br />
        <strong>Attendance policy:</strong> the {ws.policy?.threshold}% threshold is a sample configuration, not an official regulation.
      </p>
    </Modal>
  );
}

export function OverviewView() {
  const { ws } = useWorkspace();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const first = ws.student.name.split(" ")[0];
  const ns = ws.courses.find((c) => c.code === "CS201") ?? ws.courses[0];
  const threshold = ws.policy?.threshold ?? 75;
  const moved = ws.assignment.dueAt !== ws.assignment.originalDueAt;
  const mission = ws.mission;
  const activeTasks = ws.tasks.filter((t) => t.status !== "superseded");
  const dueDay = formatIstDay(ws.assignment.dueAt);

  const missionStatus = !mission
    ? null
    : mission.approval
      ? `Revision ${mission.revision} approved`
      : mission.lastInvalidated
        ? `Revision ${mission.revision} needs your approval`
        : `Revision ${mission.revision} awaiting approval`;

  return (
    <section className="view">
      <div className="page-header">
        <div>
          <div className="overline">Your personal campus agent</div>
          <h1>
            {greeting(ws.scenario.asOf)}, {first} <Asterisk size={28} strokeWidth={1.6} />
          </h1>
          <p>Here&apos;s what needs your attention. Your academic situation, in one place.</p>
        </div>
        <button className="btn btn-outline" onClick={() => setSourcesOpen(true)}>
          <Database size={14} /> Data sources
        </button>
      </div>

      <div className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Asterisk size={15} /> CAMPUSPILOT IS ON IT
          </div>
          <h2>
            One decision. <em>Your entire academic life considered.</em>
          </h2>
          <p>Can you participate in {ws.opportunity.name} without putting your attendance or deadlines at risk?</p>
          <Link className="btn btn-primary" href="/decisions">
            {mission ? "Open my decision" : "Explore my options"} <ArrowRight size={14} />
          </Link>
          {missionStatus && (
            <span className="hero-status">
              <Check size={13} /> {missionStatus}
            </span>
          )}
        </div>
        <div className="orbital" aria-hidden="true">
          <div className="orbit orbit1" />
          <div className="orbit orbit2" />
          <div className="orbit-core">
            <Asterisk size={92} strokeWidth={1.3} />
          </div>
          <span className="orbit-node node1">
            <Clock size={18} />
          </span>
          <span className="orbit-node node2">
            <FileText size={18} />
          </span>
          <span className="orbit-node node3">
            <Check size={18} />
          </span>
        </div>
      </div>

      <div className="section-heading">
        <h3>
          Needs your attention <span className="count">3</span>
        </h3>
        <Link className="btn-text" href="/decisions">
          View decisions <ArrowRight size={12} />
        </Link>
      </div>
      <div className="attention-grid">
        <Link className="attention-card" href="/decisions">
          <div className="card-icon warm">
            <Gauge size={19} />
          </div>
          <div className="eyebrow">Attendance constraint</div>
          <h4>{ns.name} is close to the example threshold</h4>
          <p>
            Currently {formatPercent(ns.currentPercent)} ({ns.attended} of {ns.total}) against a sample {threshold}% rule. Check the impact of attending {ws.opportunity.name}.
          </p>
          <span className="card-footer">
            Review attendance risk <ArrowUpRight size={13} />
          </span>
        </Link>
        <Link className="attention-card" href="/decisions">
          <div className="card-icon coral">
            <CalendarClock size={19} />
          </div>
          {moved && <span className="changed-chip">Source changed · v{ws.assignment.version}</span>}
          <div className="eyebrow">Deadline collision</div>
          <h4>{moved ? `${ws.assignment.name} deadline moved earlier` : `${ws.assignment.name} and hackathon overlap`}</h4>
          <p>{moved ? `Now due ${formatIst(ws.assignment.dueAt)} (was ${formatIst(ws.assignment.originalDueAt)}).` : `Project currently due ${formatIst(ws.assignment.dueAt)} — during the event.`}</p>
          <span className="card-footer">
            Resolve the conflict <ArrowUpRight size={13} />
          </span>
        </Link>
        <Link className="attention-card" href="/decisions">
          <div className="card-icon blue">
            <Sparkles size={19} />
          </div>
          <div className="eyebrow">Opportunity match</div>
          <h4>{ws.opportunity.name} fits your interests</h4>
          <p>Matches {ws.student.interests.slice(0, 2).join(" and ")}. Eligibility and on-duty approval are not yet verified.</p>
          <span className="card-footer">
            Evaluate opportunity <ArrowUpRight size={13} />
          </span>
        </Link>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="subhead">Your academics</span>
              <h3>Attendance snapshot</h3>
            </div>
            <span className="tag">Sample data</span>
          </div>
          {ws.courses.map((c) => {
            const near = (c.currentPercent ?? 0) < threshold + 5;
            return (
              <div className="course-row" key={c.id}>
                <div className="course-icon">{c.code === "CS201" ? "NS" : c.code === "CS203" ? "DB" : c.code === "MA202" ? "DM" : c.code.slice(0, 2)}</div>
                <div className="course-main">
                  <div className="course-line">
                    <strong>{c.name}</strong>
                    <span className="percent">{formatPercent(c.currentPercent)}</span>
                  </div>
                  <div className="course-description">
                    {c.attended} of {c.total} classes attended · {c.code}
                  </div>
                  <div className="progress" title={`Sample threshold ${threshold}%`}>
                    <div className={`bar ${near ? "weak" : ""}`} style={{ width: `${c.currentPercent ?? 0}%` }} />
                    <span className="threshold" style={{ left: `${threshold}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          <Link className="footer-link" href="/decisions">
            See projected impact <ArrowRight size={12} />
          </Link>
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="subhead">What&apos;s next</span>
              <h3>Upcoming commitments</h3>
            </div>
            <span className="tag">Oct 27–31</span>
          </div>
          <div className="timeline">
            <div className="time-entry">
              <span className="datebox">
                {formatIstDay(ws.opportunity.registrationDeadline).day}
                <small>{formatIstDay(ws.opportunity.registrationDeadline).month}</small>
              </span>
              <div>
                <strong>{ws.opportunity.name} registration closes</strong>
                <small>Opportunity · {formatIstTime(ws.opportunity.registrationDeadline)}</small>
              </div>
            </div>
            <div className="time-entry">
              <span className={`datebox ${moved ? "changed" : ""}`}>
                {dueDay.day}
                <small>{dueDay.month}</small>
              </span>
              <div>
                <strong>{ws.assignment.name}</strong>
                <small>
                  {moved ? "Updated assignment" : "Assignment"} · {formatIstTime(ws.assignment.dueAt)}
                  {moved ? ` · source v${ws.assignment.version}` : ""}
                </small>
              </div>
            </div>
            <div className="time-entry">
              <span className="datebox">
                {formatIstDay(ws.assessment.startsAt).day}
                <small>{formatIstDay(ws.assessment.startsAt).month}</small>
              </span>
              <div>
                <strong>{ws.assessment.name}</strong>
                <small>Assessment · {formatIstTime(ws.assessment.startsAt)}</small>
              </div>
            </div>
          </div>
          <Link className="footer-link" href="/decisions">
            Build a feasible plan <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {activeTasks.length > 0 && (
        <div className="panel" style={{ marginTop: 15 }}>
          <div className="panel-heading">
            <div>
              <span className="subhead">Saved on the server</span>
              <h3>Your approved tasks</h3>
            </div>
            <span className="tag tag-green">
              <ListChecks size={12} /> {activeTasks.length} tasks
            </span>
          </div>
          <TaskList />
        </div>
      )}

      <DataSourcesModal open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </section>
  );
}

export function TaskList() {
  const { ws } = useWorkspace();
  const tasks = ws.tasks.filter((t) => t.status !== "superseded");
  return (
    <div className="task-list">
      {tasks.map((t) => (
        <div className="task-row" key={t.id}>
          <span className={`task-check ${t.status === "active" ? "on" : "review"}`} aria-hidden="true">
            {t.status === "active" ? <Check size={13} strokeWidth={3} /> : "!"}
          </span>
          <div className="t-main">
            <strong>{t.title}</strong>
            <small>
              {t.blockStart ? `Block ${formatIst(t.blockStart)}` : t.dueAt ? `Due ${formatIst(t.dueAt)}` : "No date"} · from plan revision {t.originRevision} · saved{" "}
              {formatIstStamp(t.updatedAt)} IST
            </small>
          </div>
          {t.status === "active" ? <span className="tag tag-green">Current</span> : <span className="tag tag-amber">Needs review</span>}
        </div>
      ))}
    </div>
  );
}
