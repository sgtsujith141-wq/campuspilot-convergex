"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  CalendarClock,
  Check,
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  Info,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import type { DecisionOption, OptionId, TaskChange } from "@/lib/contracts";
import { formatPercent } from "@/lib/core/attendance";
import { formatBlock, formatIst, formatIstClock, formatIstStamp } from "@/lib/core/time";
import type { MissionView } from "@/lib/views";
import { TaskList } from "./overview";
import { MISSION_GOAL, Modal, useWorkspace } from "./workspace";

const TAGS = [
  { icon: Clock, label: "Attendance impact" },
  { icon: CalendarClock, label: "Assignment deadline" },
  { icon: FileText, label: "Assessment prep" },
  { icon: ShieldAlert, label: "Approval required" },
];

function eventWindow(start: string, end: string) {
  return `Oct ${Number(start.slice(8, 10))}–${Number(end.slice(8, 10))}`;
}

/** The course most affected by participation (lowest projection under the full option). */
function constraintCourseId(mission: MissionView) {
  const full = mission.result.options.find((o) => o.id === "full") ?? mission.result.options[0];
  return [...full.projections].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0].courseId;
}

function MissionCard() {
  const { ws, busy, evaluate, recalculate } = useWorkspace();
  const m = ws.mission;
  return (
    <div className="question-card">
      <div className="question-top">
        <span className="question-flag">{m ? "ACTIVE MISSION" : "NEW MISSION"}</span>
        <div className="right">
          <span className="tag">Example opportunity · {eventWindow(ws.opportunity.start, ws.opportunity.end)}</span>
          {m && <span className="tag tag-violet">Revision {m.revision}</span>}
          <span className="tag tag-amber">Offline guided workflow</span>
        </div>
      </div>
      <div className="question-main">
        <div>
          <h2>Can I attend {ws.opportunity.name}?</h2>
          {m ? (
            <p>{m.goal}</p>
          ) : (
            <p className="prompt-quote">“{MISSION_GOAL}”</p>
          )}
        </div>
        {m ? (
          <button className="btn btn-outline" onClick={recalculate} disabled={!!busy} title="Re-run the specialists against the current source versions">
            {busy === "recalculate" ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />} Re-run agents
          </button>
        ) : (
          <button className="btn btn-primary" onClick={evaluate} disabled={!!busy}>
            {busy === "evaluate" ? (
              <>
                Gathering evidence… <LoaderCircle size={14} className="spin" />
              </>
            ) : (
              <>
                Ask CampusPilot <ArrowRight size={14} />
              </>
            )}
          </button>
        )}
      </div>
      <div className="question-tags">
        {TAGS.map(({ icon: Icon, label }) => (
          <span key={label}>
            <Icon size={12} /> {label}
          </span>
        ))}
      </div>
      {!m && (
        <div className="composer-note">
          <Info size={14} />
          <span>
            The academic and opportunity specialists read your records through scoped, read-only tools; a deterministic evaluator computes every number. Offline guided workflow — no
            language model is called, nothing is submitted anywhere.
          </span>
        </div>
      )}
    </div>
  );
}

function OptionCard({ option, mission, selected, onSelect }: { option: DecisionOption; mission: MissionView; selected: boolean; onSelect: () => void }) {
  const threshold = mission.result.facts.policyThreshold;
  const focus = option.projections.find((p) => p.courseId === constraintCourseId(mission))!;
  const recommended = mission.result.recommendation.optionId === option.id;
  const approved = mission.approval?.optionId === option.id;
  const short = option.numericStatus === "NOT_OK_NUMERIC_ONLY";
  return (
    <button className={`option ${selected ? "active" : ""}`} onClick={onSelect} aria-pressed={selected} data-option={option.id}>
      <div className="option-top">
        <div className="option-badges">
          <span className="option-badge kind">{option.badge}</span>
          {recommended && <span className="option-badge rec">RECOMMENDED · CONDITIONAL</span>}
          {approved && <span className="option-badge rec">APPROVED r{mission.approval?.revision}</span>}
        </div>
        <span className="radio">{selected && <Check size={11} strokeWidth={3.2} />}</span>
      </div>
      <h4>{option.label}</h4>
      <p>{option.description}</p>
      <div className="option-metric">
        <span>
          {focus.name} projection
          <br />
          {focus.projectedAttended}/{focus.projectedTotal} · {focus.misses} event absence{focus.misses === 1 ? "" : "s"}
        </span>
        <strong className={short ? "bad" : "ok"} data-testid={`ns-${option.id}`}>
          {formatPercent(focus.percent)}
        </strong>
      </div>
      <div className={`option-outcome ${short ? "" : option.participates ? "good" : "neutral"}`}>
        {short ? (
          <>
            <TriangleAlert size={13} /> Below the sample {threshold}% threshold · policy unverified
          </>
        ) : option.participates ? (
          <>
            <CircleCheck size={13} /> Meets sample threshold · approval pending
          </>
        ) : (
          <>
            <CircleDashed size={13} /> No event absence · participation goal not met
          </>
        )}
      </div>
    </button>
  );
}

function Recommendation({ mission }: { mission: MissionView }) {
  const rec = mission.result.recommendation;
  const option = mission.result.options.find((o) => o.id === rec.optionId)!;
  return (
    <div className="panel recommendation">
      <div className="rec-main">
        <span className="subhead">Planning specialist · conditional recommendation</span>
        <h3>
          <Asterisk size={17} color="#7d75ea" /> {rec.headline}
        </h3>
        <ul>
          {rec.reasons.map((r) => (
            <li key={r}>
              <ArrowRight size={14} /> {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="conditions">
        <span className="subhead">Unknowns kept visible · not assumed</span>
        <div style={{ marginTop: 8 }}>
          {option.unknownConditions.map((u) => (
            <div className="condition" key={u.id}>
              <div>
                <strong>{u.label}</strong>
                <p>{u.reason}</p>
              </div>
              <span className="tag tag-amber tag-upper">Needs verification</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EvidenceModal({ open, onClose, mission, optionId }: { open: boolean; onClose: () => void; mission: MissionView; optionId: OptionId }) {
  const option = mission.result.options.find((o) => o.id === optionId)!;
  const refs = new Map(mission.result.evidence.map((e) => [e.id, e]));
  const policy = mission.result.evidence.find((e) => e.source === "sample_policy");
  const ns = option.projections.find((p) => p.courseId === constraintCourseId(mission))!;
  return (
    <Modal open={open} onClose={onClose} eyebrow="Explainable math · deterministic engine" title={`How “${option.label}” is calculated`}>
      <p>
        For each course with <strong>A</strong> sessions attended out of <strong>T</strong> held, <strong>H</strong> more scheduled meetings, of which the student would miss{" "}
        <strong>M</strong> because of this option:
      </p>
      <pre>Projected attendance = (A + H − M) / (T + H) × 100</pre>
      <p>
        Example — {ns.name}: ({ns.attended} + {ns.futureScheduled} − {ns.misses}) / ({ns.total} + {ns.futureScheduled}) = {ns.projectedAttended}/{ns.projectedTotal} ={" "}
        <strong>{formatPercent(ns.percent)}</strong>.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Course</th>
            <th>A</th>
            <th>T</th>
            <th>H</th>
            <th>M</th>
            <th>Projected</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {option.projections.map((p) => {
            const r = refs.get(p.evidenceRef);
            return (
              <tr key={p.courseId}>
                <td>{p.name}</td>
                <td>{p.attended}</td>
                <td>{p.total}</td>
                <td>{p.futureScheduled}</td>
                <td>{p.misses}</td>
                <td>
                  <strong>{formatPercent(p.percent)}</strong>
                  <br />
                  <code>{p.status}</code>
                </td>
                <td>
                  <code>
                    {p.evidenceRef} v{r?.recordVersion}
                  </code>
                  <br />
                  {r?.verification} · as of {r ? formatIstStamp(r.retrievedAt) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small-note">
        Threshold: {mission.result.facts.policyThreshold}% from <code>{policy?.id}</code> (isOfficial = {String(mission.result.facts.policyIsOfficial)}) — a sample configuration, not a
        VIT regulation. Assumes every other scheduled meeting is attended. OK/NOT_OK statuses describe arithmetic only: personal eligibility, CGPA-based exemptions, on-duty approval and
        course-specific rules must be verified with the institution. Computed by <code>{mission.result.engineVersion}</code>; no language model produced these numbers.
      </p>
    </Modal>
  );
}

function ActionPlan({ mission }: { mission: MissionView }) {
  const { busy, selected, approve, lastApprovalReadBack, ws } = useWorkspace();
  const drafts = mission.drafts[selected];
  const option = mission.result.options.find((o) => o.id === selected)!;
  const changes = new Map<string, TaskChange>((mission.diff?.tasks ?? []).filter((t) => t.optionId === selected).map((t) => [t.taskKey, t]));
  const approvedHere = mission.approval && mission.approval.revision === mission.revision && mission.approval.optionId === selected;
  const approvedOther = mission.approval && !approvedHere;
  const invalidated = !mission.approval && mission.lastInvalidated;
  const activeTasks = ws.tasks.filter((t) => t.status === "active").length;

  let status = <span className="tag">Awaiting approval</span>;
  if (approvedHere) status = <span className="tag tag-green">Approved · revision {mission.revision}</span>;
  else if (approvedOther) status = <span className="tag tag-violet">Another option is approved</span>;
  else if (invalidated) status = <span className="tag tag-amber">Approval invalidated · re-approve</span>;

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <span className="subhead">Recommended workflow · {option.label}</span>
          <h3>Your action plan</h3>
        </div>
        {status}
      </div>
      <div>
        {drafts.map((d, i) => {
          const ch = changes.get(d.taskKey);
          return (
            <div className={`plan-step ${ch ? "changed" : ""}`} key={d.id}>
              <div className="step-dot">{i + 1}</div>
              <div>
                {ch && <span className="changed-chip">{ch.change === "added" ? "New" : "Changed"} in revision {mission.revision}</span>}
                <strong>{d.title}</strong>
                <p>{d.detail}</p>
                {ch?.before && ch.change === "changed" && <div className="was">Was: {ch.before.block ? `${ch.before.title} · ${formatBlock(ch.before.block)}` : ch.before.title}</div>}
                <div className="step-meta">
                  {d.block && (
                    <span className="chip violet">
                      <Clock size={11} /> {formatBlock(d.block)} · suggested
                    </span>
                  )}
                  {d.dueAt && !d.block && (
                    <span className="chip">
                      <CalendarClock size={11} /> by {formatIst(d.dueAt)}
                    </span>
                  )}
                  <span className="chip mono">create_local_task</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn btn-primary btn-full" onClick={() => approve(selected)} disabled={!!busy || !!approvedHere} data-testid="approve">
        {busy === "approve" ? (
          <>
            Saving to the server… <LoaderCircle size={15} className="spin" />
          </>
        ) : approvedHere ? (
          <>
            Approved — saved as local tasks <Check size={15} />
          </>
        ) : (
          <>
            {invalidated ? `Approve revised plan (revision ${mission.revision})` : approvedOther ? "Approve this plan instead" : "Approve my action plan"} <ArrowRight size={15} />
          </>
        )}
      </button>
      {approvedHere && (
        <div className="inline-success" data-testid="approved-note">
          <CircleCheck size={15} />
          <span>
            {lastApprovalReadBack
              ? `${lastApprovalReadBack.count} tasks saved on the server and read back (GET /api/tasks) at ${formatIstClock(lastApprovalReadBack.at)} IST.`
              : `${activeTasks} tasks saved on the server for revision ${mission.revision}.`}{" "}
            Nothing was submitted to any university system.
          </span>
        </div>
      )}
      {invalidated && (
        <div className="inline-warn" data-testid="invalidated-note">
          <TriangleAlert size={15} />
          <span>
            Your revision {invalidated.revision} approval was invalidated at {formatIstClock(invalidated.invalidatedAt)} IST ({invalidated.reason}). Previously saved tasks are flagged
            “needs review” until you approve the revised plan.
          </span>
        </div>
      )}
      {!approvedHere && !invalidated && <div className="disabled-reason">Approval saves {drafts.length} local tasks only. CampusPilot never submits work or contacts anyone.</div>}
    </div>
  );
}

function SourceChangePanel() {
  const { ws, busy, sourceChange } = useWorkspace();
  const m = ws.mission;
  const moved = ws.assignment.dueAt !== ws.assignment.originalDueAt;
  const last = m?.revisions[m.revisions.length - 1];
  const showNotice = !!m && !!m.diff && m.diff.changed && last?.trigger === "source_update";
  const taskChange = m?.diff?.tasks.find((t) => t.change === "changed" && t.optionId === (m.approval?.optionId ?? m.result.recommendation.optionId));
  const reason = m?.lastInvalidated?.reason ?? (m?.diff ? `SOURCE_UPDATED ${ws.assignment.id}` : "");
  return (
    <div className="panel scenario">
      <div className="panel-heading">
        <div>
          <span className="subhead">Proactive autonomy demonstration</span>
          <h3>What if your assignment deadline suddenly changes?</h3>
          <p>The academic simulator edits one source record on the server. CampusPilot&apos;s source watcher finds every plan that depends on it and replans — no new prompt.</p>
        </div>
        <span className="pill pill-demo">CONTROLLED EVENT</span>
      </div>
      <div className="scenario-actions">
        <div className="scenario-description">
          <span className="status-icon">
            <FileText size={18} />
          </span>
          <div>
            <strong>{ws.assignment.name}</strong>
            <small data-testid="due-text">
              {moved ? "Updated due date" : "Current due date"}: {formatIst(ws.assignment.dueAt)} · record <code>{ws.assignment.id}</code> v{ws.assignment.version}
            </small>
          </div>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => sourceChange(moved ? "restore_assignment_deadline" : "advance_assignment_deadline")}
          disabled={!!busy || !ws.demoMode}
          data-testid="source-change"
        >
          {busy === "source" ? (
            <>
              <LoaderCircle size={14} className="spin" /> Updating source…
            </>
          ) : moved ? (
            <>
              <RotateCcw size={14} /> Restore original deadline
            </>
          ) : (
            <>
              Move deadline earlier <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
      {showNotice && m?.diff && (
        <div className="replanning-notice" data-testid="replan-notice">
          <div className="title">
            <Asterisk size={16} /> Replanning triggered by a source-record change — revision {m.diff.fromRevision} → {m.diff.toRevision}
          </div>
          <div className="diff-grid">
            {m.diff.facts.map((f) => (
              <div key={f.field} style={{ display: "contents" }}>
                <div className="diff-cell before">
                  <div className="eyebrow">{f.label} · before</div>
                  <div className="val">{String(f.before)}</div>
                </div>
                <div className="diff-cell">
                  <div className="eyebrow">{f.label} · now</div>
                  <div className="val">{String(f.after)}</div>
                </div>
              </div>
            ))}
          </div>
          {taskChange?.after && (
            <div>
              Changed task: <strong>{taskChange.after.title}</strong>
              {taskChange.after.block ? ` — work block moves ${taskChange.before?.block ? `from ${formatBlock(taskChange.before.block)} ` : ""}to ${formatBlock(taskChange.after.block)}.` : "."}{" "}
              {m.approval ? "" : "Your earlier approval no longer applies; review and approve the revised plan."}
            </div>
          )}
          <div className="replan-meta">
            <span className="chip violet">{reason || "SOURCE_UPDATED"}</span>
            <span className="chip">Recomputed {last ? formatIstClock(last.createdAt) : ""} IST</span>
            <Link className="chip" href="/agents">
              View replan trace <ArrowUpRight size={11} />
            </Link>
            <span className="chip">Deterministic watcher · no LLM · no ERP write</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function DecisionStudio() {
  const { ws, busy, selected, setSelected, reset } = useWorkspace();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const m = ws.mission;
  const option = m?.result.options.find((o) => o.id === selected);
  const threshold = m?.result.facts.policyThreshold ?? ws.policy?.threshold ?? 75;
  const savedTasks = ws.tasks.filter((t) => t.status !== "superseded");

  return (
    <section className="view">
      <div className="page-header">
        <div>
          <div className="overline">Cross-system reasoning</div>
          <h1>
            Decision studio <ArrowUpRight size={26} strokeWidth={2} />
          </h1>
          <p>Explore your options with academic constraints and source evidence.</p>
        </div>
        {ws.demoMode && (
          <button className="btn btn-outline" onClick={() => setResetOpen(true)} disabled={!!busy}>
            <RotateCcw size={14} /> Reset scenario
          </button>
        )}
      </div>

      <MissionCard />

      {m && option ? (
        <>
          <div className="section-heading">
            <h3>Compare viable options</h3>
            <span className="muted">Computed by the deterministic engine · sample {threshold}% policy · same sources for all three</span>
          </div>
          <div className="options">
            {m.result.options.map((o) => (
              <OptionCard key={o.id} option={o} mission={m} selected={selected === o.id} onSelect={() => setSelected(o.id)} />
            ))}
          </div>

          <Recommendation mission={m} />

          <div className="two-col planner-bottom">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="subhead">Model the consequences</span>
                  <h3>Projected attendance</h3>
                </div>
                <button className="btn-text" onClick={() => setEvidenceOpen(true)}>
                  How is this calculated? <ArrowUpRight size={12} />
                </button>
              </div>
              {option.projections.map((p) => {
                const cls = p.status === "OK_NUMERIC_ONLY" ? "ok" : p.status === "NOT_OK_NUMERIC_ONLY" ? "bad" : "unknown";
                return (
                  <div className="projected-course" key={p.courseId}>
                    <div className="projected-name">
                      <strong>{p.name}</strong>
                      <span className={`projected-number ${cls}`} data-testid={`proj-${p.courseId}`}>
                        {formatPercent(p.percent)} {cls === "ok" ? <Check size={13} strokeWidth={3} /> : cls === "bad" ? <TriangleAlert size={13} /> : <CircleDashed size={13} />}
                      </span>
                    </div>
                    <div className="progress">
                      <div className={`bar ${cls === "bad" ? "bad" : ""}`} style={{ width: `${p.percent ?? 0}%` }} />
                      <span className="threshold" style={{ left: `${threshold}%` }} title={`Sample threshold ${threshold}%`} />
                    </div>
                    <div className="course-description">
                      {p.projectedAttended}/{p.projectedTotal} projected · {p.misses} event-related absence{p.misses === 1 ? "" : "s"} · sample threshold {threshold}%
                    </div>
                  </div>
                );
              })}
              <div className="caution">
                <Gauge size={15} />
                <span>Attendance arithmetic only. Official eligibility, exemptions and on-duty approval require institutional verification — a projection is not permission.</span>
              </div>
            </div>
            <ActionPlan mission={m} />
          </div>
        </>
      ) : (
        <div className="panel" style={{ marginTop: 15 }}>
          <div className="empty-state">
            <ClipboardCheck size={28} color="#8f89ee" />
            <h3>No options yet</h3>
            <p>Ask CampusPilot above. Options, projections and an action plan appear once the specialists have gathered evidence.</p>
          </div>
        </div>
      )}

      <SourceChangePanel />

      {savedTasks.length > 0 && (
        <div className="panel" style={{ marginTop: 15 }}>
          <div className="panel-heading">
            <div>
              <span className="subhead">Executed after approval · stored on the server</span>
              <h3>Your task list</h3>
            </div>
            <span className="tag tag-green">
              <ListChecks size={12} /> {savedTasks.length} tasks
            </span>
          </div>
          <TaskList />
        </div>
      )}

      {m && <EvidenceModal open={evidenceOpen} onClose={() => setEvidenceOpen(false)} mission={m} optionId={selected} />}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        eyebrow="Controlled demo"
        title="Reset the scenario?"
        footer={
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setResetOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                setResetOpen(false);
                await reset();
              }}
            >
              Reset to seed data
            </button>
          </div>
        }
      >
        <p>This deletes Maya&apos;s mission, revisions, approvals, tasks and traces on the local server and restores the synthetic records to version 1. The audit log is kept.</p>
      </Modal>
    </section>
  );
}
