"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Cpu } from "lucide-react";
import type { AiStatusView, AskView } from "@/lib/views";
import { Alert, Badge, Spinner } from "./ui";
import { useWorkspace } from "./workspace";

const SUGGESTIONS = [
  "Which classes clash with the hackathon, and what should I do?",
  "Which deadline conflicts with the hackathon?",
  "What is my biggest attendance risk?",
  "What must I verify before I can participate?",
];
const MAX = 300;

function statusBadge(s: AiStatusView | null) {
  if (!s) return <Badge>Checking local model…</Badge>;
  if (s.status === "local_model_ready") return <Badge tone="accent">Local AI · {s.model}{s.details?.parameterSize ? ` (${s.details.parameterSize})` : ""}</Badge>;
  if (s.status === "local_model_error") return <Badge tone="bad">Model error · keyword fallback</Badge>;
  return <Badge tone="warn">Offline · keyword fallback</Badge>;
}

function seconds(ms: number | null) {
  return ms === null ? "" : `${(ms / 1000).toFixed(1)} s`;
}

export function AskPanel() {
  const { refresh } = useWorkspace();
  const [status, setStatus] = useState<AiStatusView | null>(null);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: AiStatusView) => {
        if (cancelled) return;
        setStatus(s);
        // Load the model now so the first question is not slowed by loading it.
        if (s.status === "local_model_ready") void fetch("/api/ai/warmup", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => undefined);
      })
      .catch(() => !cancelled && setStatus({ status: "local_model_unavailable", provider: "ollama", model: "", checkedAt: new Date().toISOString() }));
    return () => {
      cancelled = true;
    };
  }, []);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || pending) return;
    setQuestion(text);
    setPending(text);
    setError(null);
    try {
      const res = await fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text }) });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return window.location.assign("/overview?session=expired");
      if (!res.ok) {
        setError(body.message ?? `The question could not be answered (HTTP ${res.status}).`);
        return;
      }
      setAnswer(body as AskView);
      void refresh();
    } catch {
      setError("CampusPilot's local server did not respond. Check that it is still running.");
    } finally {
      setPending(null);
    }
  };

  const ready = status?.status === "local_model_ready";

  return (
    <section className="panel" aria-labelledby="ask-title" data-testid="ask-panel">
      <div className="panel-head">
        <div>
          <h2 id="ask-title">Ask your local agent</h2>
          <div className="sub">A model running on this computer chooses which of your records to check. Every number comes from the deterministic engine.</div>
        </div>
        <span data-testid="ai-status">{statusBadge(status)}</span>
      </div>
      <div className="panel-body ask-body">
        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <label htmlFor="ask-input" className="sr-only">
            Your question
          </label>
          <input
            id="ask-input"
            className="ask-input"
            value={question}
            maxLength={MAX}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about attendance, deadlines or what to verify…"
            autoComplete="off"
            data-testid="ask-input"
          />
          <button className="btn btn-primary btn-lg" type="submit" disabled={!!pending || !question.trim()} data-testid="ask-submit">
            {pending ? <Spinner /> : null} Ask
          </button>
        </form>
        <div className="suggestions" role="group" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="suggestion" onClick={() => ask(s)} disabled={!!pending}>
              {s}
            </button>
          ))}
        </div>

        {pending && (
          <div className="ask-pending" role="status" data-testid="ask-pending">
            <Spinner /> {ready ? `${status?.model} is choosing what to check…` : "Routing with the keyword fallback…"}
          </div>
        )}
        {error && !pending && (
          <Alert tone="bad" role="alert">
            {error}
          </Alert>
        )}
        {answer && !pending && <AnswerView a={answer} />}
      </div>
    </section>
  );
}

const TOOL_LABEL: Record<string, string> = {
  get_my_attendance: "Attendance records",
  get_my_courses: "Course list",
  get_applicable_policy: "Attendance policy (sample)",
  get_my_commitments: "Deadlines and assessments",
  get_my_timetable: "Class timetable",
  get_event: "Event listing",
  verify_event_rules: "Event rules",
};

/** Scroll to a Decisions section, evaluating the guided mission first if it does not exist yet. */
function useGoTo() {
  const { ws, evaluate } = useWorkspace();
  return async (target: "timetable" | "compare" | "plan") => {
    const id = target === "timetable" ? "timetable" : target === "compare" ? "compare" : "action-plan";
    if (target !== "timetable" && !ws.mission) {
      const ok = await evaluate(ws.opportunity.id);
      if (!ok) return;
      await new Promise((r) => setTimeout(r, 120));
    }
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  };
}

const ACTION_LABEL = { timetable: "View timetable", compare: "Compare my options", plan: "Review action plan" } as const;

function AnswerView({ a }: { a: AskView }) {
  const { busy } = useWorkspace();
  const go = useGoTo();
  const routedBy =
    a.routing.source === "model"
      ? `${a.model} chose this investigation in ${seconds(a.routing.modelMs)}${a.routing.attempts > 1 ? ` (${a.routing.attempts} attempts)` : ""}`
      : a.routing.source === "scope_check"
        ? "Refused by the server scope check — the model was not called"
        : "Keyword fallback — not model output";
  const doc = a.answer;
  return (
    <div className="answer" data-testid="ask-answer" data-mode={a.mode}>
      {a.stale && <Alert tone="warn">Your records changed while this answer was being prepared. Ask again for a current answer.</Alert>}
      {doc ? (
        <>
          <h3 className="answer-headline" data-testid="ask-headline">
            {doc.headline}
          </h3>
          {doc.items.length > 0 && (
            <ol className="answer-items" data-testid="ask-findings">
              {doc.items.map((it, i) => (
                <li key={it.title + i}>
                  <div className="ai-title">
                    <strong>
                      {i + 1}. {it.title}
                    </strong>
                    {it.tag && <Badge tone={it.tone === "ok" ? "ok" : it.tone === "bad" ? "bad" : it.tone === "warn" ? "warn" : "neutral"}>{it.tag}</Badge>}
                  </div>
                  <p>{it.detail}</p>
                </li>
              ))}
            </ol>
          )}
          {doc.nextStep && (
            <div className="next-step">
              <h4>Your best next step</h4>
              <p>{doc.nextStep}</p>
            </div>
          )}
          {doc.clashes.length > 0 && (
            <div className="clash-grid" data-testid="ask-clashes">
              {doc.clashes.map((c) => (
                <div key={c.optionId} className="clash-col">
                  <strong>{c.label}</strong>
                  <span className="muted text-xs">{c.window}</span>
                  {c.sessions.length === 0 ? (
                    <span className="clash-none">No class clashes</span>
                  ) : (
                    <ul>
                      {c.sessions.map((s) => (
                        <li key={s.id}>
                          <span>{s.course}</span>
                          <span className="muted text-xs">
                            {s.type} · {s.when} · {s.room}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="answer-actions">
            {doc.actions.map((act) => (
              <button key={act} type="button" className={act === "compare" ? "btn btn-primary" : "btn btn-secondary"} onClick={() => go(act)} disabled={!!busy} data-testid={`ask-action-${act}`}>
                {ACTION_LABEL[act]}
              </button>
            ))}
          </div>
          {doc.verify.length > 0 && <p className="verify-note">Needs verification: {doc.verify.join(" ")}</p>}
        </>
      ) : (
        <h3 className="answer-headline" data-testid="ask-headline">
          {a.status === "unsupported" ? "CampusPilot can't answer that one." : "No answer could be computed."}
        </h3>
      )}
      {a.notes.map((n) => (
        <Alert key={n} tone={a.status === "unsupported" ? "info" : "warn"}>
          {n}
        </Alert>
      ))}
      {a.summary?.accepted && (
        <div className="next-step">
          <h4>Model summary (validated)</h4>
          <p>{a.summary.text}</p>
        </div>
      )}
      <details className="disclosure inspector" data-testid="ask-inspector">
        <summary>
          <Cpu size={14} aria-hidden="true" /> How CampusPilot answered
        </summary>
        <dl className="answer-meta">
          <div>
            <dt>Question</dt>
            <dd>{a.question}</dd>
          </div>
          <div>
            <dt>Routing</dt>
            <dd data-testid="ask-routing">{routedBy}</dd>
          </div>
          <div>
            <dt>Interpreted as</dt>
            <dd data-testid="ask-intent">{a.intentLabel}</dd>
          </div>
          {a.tools.length > 0 && (
            <div>
              <dt>Records checked</dt>
              <dd data-testid="ask-tools">
                <ul className="tool-list">
                  {a.tools.map((t) => (
                    <li key={t.name}>
                      {TOOL_LABEL[t.name] ?? t.name} <span className="muted">— {t.requestedBy === "model" ? "requested by the model" : "added by the server (needed for the calculation)"}</span>{" "}
                      <code>{t.name}</code>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div>
            <dt>Sources</dt>
            <dd className="text-sm">{a.sources.length ? a.sources.map((s) => `${s.id} v${s.version} (${s.verification})`).join(" · ") : "None read"} · nothing was changed</dd>
          </div>
          <div>
            <dt>Numbers</dt>
            <dd className="text-sm">Computed by the deterministic engine from these records, not by the model.</dd>
          </div>
        </dl>
        <Link className="link text-sm" href={`/agents?run=${a.runId}`} data-testid="ask-trace">
          View the recorded trace <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </details>
    </div>
  );
}
