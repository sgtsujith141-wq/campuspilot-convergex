"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronRight, CircleCheck, FlaskConical, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import type { DecisionOption, OptionId, TaskChange } from "@/lib/contracts";
import { formatPercent } from "@/lib/core/attendance";
import { formatBlock, formatDateRange, formatIst, formatIstClock, formatIstStamp } from "@/lib/core/time";
import { OPTION_LABEL, assignmentMoved, dueDuringEvent, missionState, registrationFor, registrationText } from "@/lib/present";
import type { MissionView, WorkspaceSnapshot } from "@/lib/views";
import { AskPanel } from "./ask";
import { Alert, Badge, Dialog, Spinner, cx } from "./ui";
import { useWorkspace } from "./workspace";

const PARTICIPATION: Record<OptionId, string> = { full: "Both days", partial: "Part of the event", defer: "None" };
const SHORT_LABEL: Record<OptionId, string> = { full: "Full event", partial: "Selected sessions", defer: "Defer" };

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  el.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
}

/** The course that participation affects most (lowest projection under full attendance). */
function constraintCourseId(mission: MissionView) {
  const full = mission.result.options.find((o) => o.id === "full") ?? mission.result.options[0];
  return [...full.projections].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0].courseId;
}

// ── Guided mission setup ─────────────────────────────────────────────────────

function MissionSetup() {
  const { ws, busy, evaluate } = useWorkspace();
  const [opportunityId, setOpportunityId] = useState(ws.opportunity.id);
  return (
    <section className="panel mission-setup" aria-labelledby="setup-title">
      <div className="eyebrow">Guided mission</div>
      <h2 id="setup-title">Event participation check</h2>
      <p>This demo evaluates one kind of decision: whether you can attend an event without breaking academic constraints. It works from structured records — there is no free-text box, because nothing here would interpret it.</p>
      <ul className="checks">
        {[
          "Reads your attendance, assignments and assessment",
          "Retrieves the event's dates and registration window",
          "Projects attendance for full, partial and no participation",
          "Prepares a plan for you to approve — nothing is submitted",
        ].map((t) => (
          <li key={t}>
            <Check size={15} aria-hidden="true" /> {t}
          </li>
        ))}
      </ul>
      <div className="setup-row">
        <div className="field">
          <label htmlFor="opportunity">Opportunity</label>
          <select id="opportunity" className="select" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
            {ws.opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {formatDateRange(o.start, o.end)}
                {o.fictional ? " (fictional)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => evaluate(opportunityId)} disabled={!!busy} data-testid="evaluate">
          {busy === "evaluate" ? (
            <>
              <Spinner /> Evaluating…
            </>
          ) : (
            <>
              Evaluate options <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
      <p className="text-sm muted" style={{ marginTop: "0.75rem" }}>
        Runs a deterministic agent workflow on the server. No language model is called.
      </p>
    </section>
  );
}

// ── Signature moment: what changed and why ──────────────────────────────────

function PlanUpdate({ mission, ws }: { mission: MissionView; ws: WorkspaceSnapshot }) {
  const { selected } = useWorkspace();
  const last = mission.revisions[mission.revisions.length - 1];
  if (!mission.diff || !mission.diff.changed || last?.trigger !== "source_update") return null;
  const due = mission.diff.facts.find((f) => f.field === "assignmentDueAt");
  const optionForBlock = mission.approval?.optionId ?? mission.lastInvalidated?.optionId ?? selected;
  const block: TaskChange | undefined =
    mission.diff.tasks.find((t) => t.optionId === optionForBlock && t.change === "changed" && t.before?.block && t.after?.block) ??
    mission.diff.tasks.find((t) => t.change === "changed" && t.before?.block && t.after?.block);
  const invalidated = !mission.approval ? mission.lastInvalidated : null;
  const version = ws.assignment.version;
  return (
    <section className="update" id="plan-update" aria-labelledby="update-title" data-testid="replan-notice">
      <div className="update-head">
        <h2 id="update-title" tabIndex={-1}>
          <TriangleAlert size={17} aria-hidden="true" /> Your plan changed because a source changed
        </h2>
        <span data-dynamic>
          Revision {mission.diff.fromRevision} → {mission.diff.toRevision} · {formatIstClock(last.createdAt)} IST
        </span>
      </div>
      <ol className="update-steps">
        <li className="update-step">
          <span className="idx" aria-hidden="true">
            1
          </span>
          <div>
            <h3>{due ? "Assignment deadline changed" : "A source record changed"}</h3>
            {due && (
              <div className="change" data-testid="deadline-change">
                <span className="old">{String(due.before)}</span>
                <ArrowRight size={18} aria-label="changed to" />
                <span className="new">{String(due.after)}</span>
              </div>
            )}
            <p className="change-note">
              {ws.assignment.name} · academic simulator record, version {version - 1} → {version}
            </p>
          </div>
        </li>
        <li className="update-step">
          <span className="idx" aria-hidden="true">
            2
          </span>
          <div>
            <h3>CampusPilot updated your plan</h3>
            {block?.before?.block && block.after?.block ? (
              <>
                <div className="change" data-testid="block-change">
                  <span className="old">{formatBlock(block.before.block)}</span>
                  <ArrowRight size={18} aria-label="moved to" />
                  <span className="new">{formatBlock(block.after.block)}</span>
                </div>
                <p className="change-note">
                  Work block for “{block.after.title}” · {OPTION_LABEL[block.optionId]}
                </p>
              </>
            ) : (
              <p className="change-note">{mission.diff.tasks.length} planned action(s) changed. Review them below.</p>
            )}
          </div>
        </li>
        <li className="update-step">
          <span className="idx" aria-hidden="true">
            3
          </span>
          <div>
            {mission.approval ? (
              <>
                <h3>You approved revision {mission.approval.revision}</h3>
                <p className="change-note">Your plan is up to date with the changed source.</p>
              </>
            ) : invalidated ? (
              <>
                <h3>Your previous approval needs review</h3>
                <p className="change-note" data-dynamic>
                  Approval of revision {invalidated.revision} was invalidated at {formatIstClock(invalidated.invalidatedAt)} IST. Tasks saved from it are marked “needs review”.
                </p>
                <button className="btn btn-primary" onClick={() => scrollToId("action-plan")} data-testid="review-revision">
                  Review revision {mission.revision} <ArrowRight size={15} aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <h3>No approval was affected</h3>
                <p className="change-note">Nothing had been approved yet. Review revision {mission.revision} before approving.</p>
              </>
            )}
          </div>
        </li>
      </ol>
      <details className="disclosure">
        <summary>
          <ChevronRight size={14} aria-hidden="true" /> Technical details
        </summary>
        <dl className="tech">
          <dt>Event</dt>
          <dd>SOURCE_UPDATED</dd>
          <dt>Source record</dt>
          <dd>
            {ws.assignment.id} v{version - 1} → v{version}
          </dd>
          <dt>Mission</dt>
          <dd>{mission.id}</dd>
          <dt>Revision</dt>
          <dd>
            {mission.diff.fromRevision} → {mission.diff.toRevision}
          </dd>
          <dt>Recomputed</dt>
          <dd>{last.createdAt}</dd>
          <dt>Run</dt>
          <dd>
            <Link className="link" href="/agents">
              {last.runId}
            </Link>
          </dd>
          <dt>Mode</dt>
          <dd>deterministic workflow · no model · no ERP write</dd>
        </dl>
      </details>
    </section>
  );
}

// ── Comparison ───────────────────────────────────────────────────────────────

function conflictFor(o: DecisionOption, ws: WorkspaceSnapshot): { text: string; tone: "ok" | "warn" | "bad" | "muted" } {
  if (o.hardViolations.some((v) => v.startsWith("Registration"))) return { text: "Registration closed", tone: "bad" };
  if (o.participates && dueDuringEvent(ws)) return { text: "Assignment due during the event", tone: "warn" };
  return { text: "None found", tone: "muted" };
}

function policyCell(o: DecisionOption, threshold: number | null) {
  if (o.numericStatus === "OK_NUMERIC_ONLY") return { text: `Meets ${threshold}% (sample)`, tone: "ok" as const };
  if (o.numericStatus === "NOT_OK_NUMERIC_ONLY") return { text: `Below ${threshold}% (sample)`, tone: "bad" as const };
  return { text: "No policy to compare", tone: "warn" as const };
}

function Comparison({ mission, ws }: { mission: MissionView; ws: WorkspaceSnapshot }) {
  const { selected, setSelected } = useWorkspace();
  const [evidence, setEvidence] = useState(false);
  const options = mission.result.options;
  const threshold = mission.result.facts.policyThreshold;
  const focusId = constraintCourseId(mission);
  const courseIds = options[0].projections.map((p) => p.courseId);
  const others = courseIds.filter((c) => c !== focusId);
  const sel = options.find((o) => o.id === selected)!;
  const focus = sel.projections.find((p) => p.courseId === focusId)!;
  const cls = (id: OptionId) => (id === selected ? "sel" : undefined);
  const recId = mission.result.recommendation.optionId;

  return (
    <section className="panel" aria-labelledby="compare-title">
      <div className="panel-head">
        <div>
          <h2 id="compare-title">Compare options</h2>
          <div className="sub">Same records for all three · calculated by the deterministic engine, not a model</div>
        </div>
        <button className="link text-sm" onClick={() => setEvidence(true)}>
          How it’s calculated
        </button>
      </div>
      <div className="segmented" role="group" aria-label="Choose an option to inspect">
        {options.map((o) => (
          <button key={o.id} aria-pressed={o.id === selected} onClick={() => setSelected(o.id)}>
            {SHORT_LABEL[o.id]}
          </button>
        ))}
      </div>
      <div className="table-scroll">
        <table className="compare">
          <thead>
            <tr>
              <th className="rowhead" scope="col">
                <span className="sr-only">Measure</span>
              </th>
              {options.map((o) => (
                <th key={o.id} className={cls(o.id)} scope="col">
                  <button className="opt-head" onClick={() => setSelected(o.id)} aria-pressed={o.id === selected} data-option={o.id}>
                    <span className="top">
                      <strong>{o.label}</strong>
                      <span className="radio" aria-hidden="true" />
                    </span>
                    {o.hardViolations.length > 0 ? (
                      <span className="blocked">Not possible</span>
                    ) : o.id === recId ? (
                      <span className="rec">Recommended · conditional</span>
                    ) : (
                      <span className="muted text-xs">{o.badge}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="rowhead" scope="row">
                {focus.name} projection
              </th>
              {options.map((o) => {
                const p = o.projections.find((x) => x.courseId === focusId)!;
                return (
                  <td key={o.id} className={cls(o.id)} data-testid={o.id === selected ? `proj-${focusId}` : undefined}>
                    <div className="big">
                      <strong className={p.status === "NOT_OK_NUMERIC_ONLY" ? "bad" : undefined} data-testid={`ns-${o.id}`}>
                        {formatPercent(p.percent)}
                      </strong>
                      <span>
                        {p.projectedAttended}/{p.projectedTotal}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
            {others.map((cid) => {
              const name = options[0].projections.find((p) => p.courseId === cid)!.name;
              return (
                <tr key={cid}>
                  <th className="rowhead" scope="row">
                    {name}
                  </th>
                  {options.map((o) => {
                    const p = o.projections.find((x) => x.courseId === cid)!;
                    return (
                      <td key={o.id} className={cx("num", cls(o.id))} data-testid={o.id === selected ? `proj-${cid}` : undefined}>
                        {formatPercent(p.percent)}
                        <span className="cell-sub">
                          {p.projectedAttended}/{p.projectedTotal}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <th className="rowhead" scope="row">
                Participation
              </th>
              {options.map((o) => (
                <td key={o.id} className={cls(o.id)}>
                  {PARTICIPATION[o.id]}
                </td>
              ))}
            </tr>
            <tr>
              <th className="rowhead" scope="row">
                Classes missed
              </th>
              {options.map((o) => (
                <td key={o.id} className={cls(o.id)}>
                  <span className="num">{o.totalAbsences}</span>
                  <span className="cell-sub">Scenario estimate</span>
                </td>
              ))}
            </tr>
            <tr>
              <th className="rowhead" scope="row">
                Conflicts
              </th>
              {options.map((o) => {
                const c = conflictFor(o, ws);
                return (
                  <td key={o.id} className={cls(o.id)}>
                    <span className={cx("cell-status", c.tone)}>{c.text}</span>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th className="rowhead" scope="row">
                Sample-policy check
              </th>
              {options.map((o) => {
                const c = policyCell(o, threshold);
                return (
                  <td key={o.id} className={cls(o.id)}>
                    <span className={cx("cell-status", c.tone)}>
                      {c.tone === "ok" ? <Check size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}
                      {c.text}
                    </span>
                    <span className="cell-sub">Arithmetic only, not eligibility</span>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th className="rowhead" scope="row">
                Still to verify
              </th>
              {options.map((o) => (
                <td key={o.id} className={cls(o.id)}>
                  {o.unknownConditions.length} item{o.unknownConditions.length === 1 ? "" : "s"}
                  <span className="cell-sub">{o.unknownConditions.map((u) => u.label).join(" · ")}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="panel-foot compare-foot">
        <code data-testid="formula-line">
          {focus.name}: ({focus.attended} + {focus.futureScheduled} − {focus.misses}) / ({focus.total} + {focus.futureScheduled}) = {focus.projectedAttended}/{focus.projectedTotal} ={" "}
          {formatPercent(focus.percent)}
        </code>
        <span>A projection is not institutional approval.</span>
      </div>
      <EvidenceDialog open={evidence} onClose={() => setEvidence(false)} mission={mission} option={sel} />
    </section>
  );
}

function EvidenceDialog({ open, onClose, mission, option }: { open: boolean; onClose: () => void; mission: MissionView; option: DecisionOption }) {
  const refs = new Map(mission.result.evidence.map((e) => [e.id, e]));
  const policy = mission.result.evidence.find((e) => e.source === "sample_policy");
  const ns = option.projections.find((p) => p.courseId === constraintCourseId(mission))!;
  return (
    <Dialog open={open} onClose={onClose} title={`How “${option.label}” is calculated`} description={`Deterministic engine ${mission.result.engineVersion} · no language model produced these numbers`}>
      <p>
        For each course: <strong>A</strong> classes attended of <strong>T</strong> held, <strong>H</strong> more scheduled, of which <strong>M</strong> are missed under this option.
      </p>
      <div className="formula">Projected attendance = (A + H − M) / (T + H) × 100</div>
      <p>
        {ns.name}: ({ns.attended} + {ns.futureScheduled} − {ns.misses}) / ({ns.total} + {ns.futureScheduled}) = {ns.projectedAttended}/{ns.projectedTotal} ={" "}
        <strong>{formatPercent(ns.percent)}</strong>
      </p>
      <div className="table-scroll">
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
                  </td>
                  <td>
                    <code>
                      {p.evidenceRef} v{r?.recordVersion}
                    </code>
                    <br />
                    {r?.verification} · {r ? formatIstStamp(r.retrievedAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm">
        The {mission.result.facts.policyThreshold}% comparison comes from <code>{policy?.id}</code>, a sample configuration (isOfficial = {String(mission.result.facts.policyIsOfficial)}). It assumes
        every other scheduled class is attended. Missed-class counts are scenario estimates, not a checked timetable. Eligibility, exemptions and on-duty approval must be confirmed with the
        institution.
      </p>
    </Dialog>
  );
}

// ── Recommendation ───────────────────────────────────────────────────────────

function Recommendation({ mission }: { mission: MissionView }) {
  const { selected } = useWorkspace();
  const rec = mission.result.recommendation;
  const option = mission.result.options.find((o) => o.id === rec.optionId)!;
  return (
    <section className="panel rec-panel" aria-labelledby="rec-title" data-testid="recommendation">
      <div>
        <div className="eyebrow">Recommendation{rec.conditional ? " · conditional" : ""}</div>
        <h3 id="rec-title">{option.label}</h3>
        <ul className="reasons">
          {rec.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {selected !== rec.optionId && (
          <p className="text-sm muted" style={{ marginTop: "0.75rem" }}>
            You are inspecting “{OPTION_LABEL[selected]}”. The recommendation only changes when your records do.
          </p>
        )}
      </div>
      <div>
        <div className="eyebrow">Before you act, verify</div>
        <ul className="verify-list">
          {option.unknownConditions.map((u) => (
            <li key={u.id}>
              <span className="box" aria-hidden="true" />
              <span>
                <strong>{u.label}</strong>
                <span>{u.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Action plan + approval ───────────────────────────────────────────────────

function ActionPlan({ mission, ws }: { mission: MissionView; ws: WorkspaceSnapshot }) {
  const { busy, selected, approve, readBack, error, clearError } = useWorkspace();
  const option = mission.result.options.find((o) => o.id === selected)!;
  const drafts = mission.drafts[selected];
  const changes = new Map<string, TaskChange>((mission.diff?.tasks ?? []).filter((t) => t.optionId === selected).map((t) => [t.taskKey, t]));
  const approvedHere = !!mission.approval && mission.approval.revision === mission.revision && mission.approval.optionId === selected;
  const approvedOther = !!mission.approval && !approvedHere;
  const invalidated = !mission.approval ? mission.lastInvalidated : null;
  const blocked = option.hardViolations.length > 0;
  const savedTasks = new Map(ws.tasks.map((t) => [t.taskKey, t]));
  const stale = error?.action === "approve" && error.code === "STALE_REVISION";

  let badge = <Badge>Draft · not approved</Badge>;
  if (approvedHere) badge = <Badge tone="ok">Approved · revision {mission.revision}</Badge>;
  else if (approvedOther) badge = <Badge>Another option is approved</Badge>;
  else if (invalidated) badge = <Badge tone="warn">Approval needs review</Badge>;

  return (
    <section className="panel" id="action-plan" aria-labelledby="plan-title">
      <div className="panel-head">
        <div>
          <h2 id="plan-title" tabIndex={-1}>
            Action plan · {option.label}
          </h2>
          <div className="sub">
            {drafts.length} local tasks · created only after you approve · revision {mission.revision}
          </div>
        </div>
        {badge}
      </div>
      <ol className="plan-list">
        {drafts.map((d, i) => {
          const ch = changes.get(d.taskKey);
          const saved = savedTasks.get(d.taskKey);
          const state = approvedHere ? "saved" : saved?.status === "needs_review" ? "review" : "draft";
          return (
            <li className={cx("plan-item", ch && "changed")} key={d.id} data-task={d.taskKey}>
              <span className="n" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <strong>{d.title}</strong>
                <p>{d.detail}</p>
                <div className="when">
                  {d.block ? (
                    <>
                      {formatBlock(d.block)} <span className="muted">· suggested time</span>
                    </>
                  ) : d.dueAt ? (
                    <>
                      By {formatIst(d.dueAt)} <span className="muted">· deadline</span>
                    </>
                  ) : (
                    <span className="muted">No date</span>
                  )}
                </div>
                {ch?.change === "changed" && ch.before && (
                  <div className="was" data-testid="changed-task">
                    Changed in revision {mission.revision} · was <s>{ch.before.block ? formatBlock(ch.before.block) : ch.before.title}</s>
                  </div>
                )}
                {ch?.change === "added" && <div className="was">New in revision {mission.revision}</div>}
              </div>
              {state === "saved" ? <Badge tone="ok">Saved</Badge> : state === "review" ? <Badge tone="warn">Needs review</Badge> : <Badge>Draft</Badge>}
            </li>
          );
        })}
      </ol>
      <div className="panel-foot">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {stale && (
            <Alert tone="warn" role="alert">
              <strong>The plan changed while you were reviewing it.</strong> You are now looking at revision {mission.revision}. Check what changed, then approve again.{" "}
              <button className="link" onClick={clearError}>
                Dismiss
              </button>
            </Alert>
          )}
          {error?.action === "approve" && !stale && (
            <Alert tone="bad" role="alert">
              {error.message}
            </Alert>
          )}
          {blocked && <Alert tone="bad">This option is not possible: {option.hardViolations[0]}</Alert>}
          {approvedHere && (
            <div data-testid="approved-note" data-dynamic>
              <Alert tone="ok">
                <strong>Saved {readBack && readBack.revision === mission.revision ? readBack.count : drafts.length} tasks on the server</strong>
                {readBack && readBack.revision === mission.revision ? ` and read them back at ${formatIstClock(readBack.at)} IST` : ""}. This approves your CampusPilot plan only — it is not
                on-duty permission or event registration.
              </Alert>
            </div>
          )}
          {invalidated && (
            <div data-testid="invalidated-note" data-dynamic>
              <Alert tone="warn">
                Your approval of revision {invalidated.revision} was invalidated at {formatIstClock(invalidated.invalidatedAt)} IST because a source changed. Approve revision {mission.revision} to
                update your tasks.
              </Alert>
            </div>
          )}
          <div className="approve-bar">
            <p>Approving creates local reminders in CampusPilot. It does not submit work, register you, or request on-duty permission.</p>
            <button className="btn btn-primary btn-lg" onClick={() => approve(selected)} disabled={!!busy || approvedHere || blocked} data-testid="approve">
              {busy === "approve" ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : approvedHere ? (
                <>
                  <CircleCheck size={16} aria-hidden="true" /> Approved
                </>
              ) : invalidated ? (
                `Approve revision ${mission.revision}`
              ) : approvedOther ? (
                "Approve this option instead"
              ) : (
                "Approve plan"
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Rail: status, facts, demo controls ───────────────────────────────────────

function Rail() {
  const { ws, busy, sourceChange, reset } = useWorkspace();
  const [resetOpen, setResetOpen] = useState(false);
  const m = ws.mission;
  const state = missionState(m);
  const moved = assignmentMoved(ws);
  const reg = registrationText(registrationFor(ws));
  const planBadge =
    state === "approved" ? <Badge tone="ok">Approved · r{m!.revision}</Badge> : state === "needs_review" ? <Badge tone="warn">Needs review</Badge> : <Badge>Not approved</Badge>;

  const change = async () => {
    const ok = await sourceChange(moved ? "restore_assignment_deadline" : "advance_assignment_deadline");
    if (ok) window.setTimeout(() => scrollToId("plan-update"), 50);
  };

  return (
    <aside className="rail" aria-label="Decision status">
      <section className="panel" aria-labelledby="status-title" data-testid="approval-status">
        <div className="panel-head">
          <h2 id="status-title">Approval status</h2>
        </div>
        <ul className="status-list">
          <li>
            <span>
              <strong>Your CampusPilot plan</strong>
              <span className="who">Decided by you</span>
            </span>
            {planBadge}
          </li>
          <li>
            <span>
              <strong>On-duty permission</strong>
              <span className="who">Granted by your institution</span>
            </span>
            <Badge tone="warn">Not verified</Badge>
          </li>
          <li>
            <span>
              <strong>Event eligibility</strong>
              <span className="who">Confirmed by the organisers</span>
            </span>
            <Badge tone="warn">Not verified</Badge>
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="facts-title">
        <div className="panel-head">
          <h2 id="facts-title">Key facts</h2>
        </div>
        <ul className="fact-list">
          <li>
            <span>Event</span>
            <strong>
              {ws.opportunity.name} · {formatDateRange(ws.opportunity.start, ws.opportunity.end)}
            </strong>
          </li>
          <li>
            <span>Registration</span>
            <strong>{reg.label}</strong>
          </li>
          <li>
            <span>Assignment due</span>
            <strong data-testid="due-text">{formatIst(ws.assignment.dueAt)}</strong>
            {moved && <em>Changed from {formatIst(ws.assignment.originalDueAt)}</em>}
          </li>
          <li>
            <span>Assessment</span>
            <strong>{formatIst(ws.assessment.startsAt)}</strong>
          </li>
          <li>
            <span>Attendance rule</span>
            <strong>{ws.policy ? `${ws.policy.threshold}% · sample, not official` : "None on record"}</strong>
          </li>
          <li>
            <span>Timetable</span>
            <strong>Not connected</strong>
          </li>
        </ul>
      </section>

      {ws.demoMode && (
        <section className="demo-box" aria-labelledby="demo-title" data-testid="demo-controls">
          <div className="label" id="demo-title">
            <FlaskConical size={14} aria-hidden="true" /> Controlled demo
          </div>
          <p>Simulates a change in the academic source. The server then re-plans every decision that depends on it.</p>
          <button className="btn btn-secondary btn-block" onClick={change} disabled={!!busy} data-testid="source-change">
            {busy === "source" ? (
              <>
                <Spinner /> Updating source…
              </>
            ) : moved ? (
              <>
                <RotateCcw size={15} aria-hidden="true" /> Restore original deadline
              </>
            ) : (
              `Move deadline to ${formatIst(ws.assignment.demoDueAt)}`
            )}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setResetOpen(true)} disabled={!!busy} data-testid="reset">
            Reset demo
          </button>
          <Dialog
            open={resetOpen}
            onClose={() => setResetOpen(false)}
            title="Reset the demo?"
            description="Restores the seed scenario on the local server."
            footer={
              <>
                <button className="btn btn-secondary" onClick={() => setResetOpen(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    setResetOpen(false);
                    await reset();
                  }}
                  data-testid="confirm-reset"
                >
                  Reset demo
                </button>
              </>
            }
          >
            <p>This deletes the fictional student’s decision, revisions, approvals, tasks and activity, and restores the synthetic records to version 1. The security audit log is kept.</p>
          </Dialog>
        </section>
      )}
    </aside>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function DecisionStudio() {
  const { ws, busy, recalculate, error, clearError } = useWorkspace();
  const m = ws.mission;
  const seen = useRef(m?.id ?? null);

  // Arriving from a link to the update section.
  useEffect(() => {
    if (window.location.hash === "#plan-update") window.setTimeout(() => scrollToId("plan-update"), 50);
  }, []);
  // A freshly evaluated mission starts at the top of the page.
  useEffect(() => {
    if (m && seen.current !== m.id) {
      seen.current = m.id;
      window.scrollTo({ top: 0 });
    }
  }, [m]);

  const pageError = error && error.action !== "approve" ? error : null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Guided mission · Event participation</div>
          <h1>{m ? `Can I attend ${ws.opportunity.name}?` : "Evaluate a decision"}</h1>
          <div className="meta">
            {m ? (
              <>
                <span data-testid="revision">Revision {m.revision}</span>
                <span className="sep">·</span>
                <span data-dynamic>Updated {formatIstStamp(m.updatedAt)} IST</span>
                <span className="sep">·</span>
                <span>Deterministic agent workflow</span>
              </>
            ) : (
              <span>One supported mission type · synthetic records</span>
            )}
          </div>
        </div>
        {m && (
          <div className="actions">
            <button className="btn btn-secondary" onClick={recalculate} disabled={!!busy} title="Re-run the workflow against the current source versions">
              {busy === "recalculate" ? <Spinner /> : <RefreshCw size={15} aria-hidden="true" />} Re-run evaluation
            </button>
          </div>
        )}
      </header>

      {pageError && (
        <div style={{ marginBottom: "1.25rem" }}>
          <Alert tone="bad" role="alert">
            {pageError.message}{" "}
            <button className="link" onClick={clearError}>
              Dismiss
            </button>
          </Alert>
        </div>
      )}

      <div className="decision-layout">
        <div className="decision-main">
          {m ? (
            <>
              <PlanUpdate mission={m} ws={ws} />
              <AskPanel />
              <Comparison mission={m} ws={ws} />
              <Recommendation mission={m} />
              <ActionPlan mission={m} ws={ws} />
            </>
          ) : (
            <>
              <AskPanel />
              <MissionSetup />
            </>
          )}
        </div>
        <Rail />
      </div>
    </div>
  );
}
