"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Cpu } from "lucide-react";
import type { AiStatusView, AskView } from "@/lib/views";
import { Alert, Badge, Spinner } from "./ui";
import { useWorkspace } from "./workspace";

const SUGGESTIONS = ["What is my biggest attendance risk?", "Which deadline conflicts with the hackathon?", "What must I verify before I can participate?"];
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

function AnswerView({ a }: { a: AskView }) {
  const routedBy =
    a.routing.source === "model"
      ? `${a.model} · ${seconds(a.routing.modelMs)}${a.routing.attempts > 1 ? ` · ${a.routing.attempts} attempts` : ""}`
      : a.routing.source === "scope_check"
        ? "server scope check · model not called"
        : "keyword fallback · not model output";
  return (
    <div className="answer" data-testid="ask-answer" data-mode={a.mode}>
      <dl className="answer-meta">
        <div>
          <dt>Question</dt>
          <dd>{a.question}</dd>
        </div>
        <div>
          <dt>Interpreted as</dt>
          <dd>
            <strong data-testid="ask-intent">{a.intentLabel}</strong> <span className="muted">by {routedBy}</span>
          </dd>
        </div>
        {a.tools.length > 0 && (
          <div>
            <dt>Records checked</dt>
            <dd className="tool-chips" data-testid="ask-tools">
              {a.tools.map((t) => (
                <span key={t.name} className={`tool-chip ${t.requestedBy}`} title={t.requestedBy === "model" ? "Requested by the local model" : "Added by the server: required for the calculation"}>
                  {t.name}
                  <em>{t.requestedBy === "model" ? "model" : "server"}</em>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {a.stale && <Alert tone="warn">Your records changed while this answer was being prepared. Ask again for a current answer.</Alert>}

      {a.findings.length > 0 && (
        <div className="answer-block">
          <h3>Finding</h3>
          <ul data-testid="ask-findings">
            {a.findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {a.summary?.accepted && (
        <div className="answer-block">
          <h3>Model summary</h3>
          <p>{a.summary.text}</p>
        </div>
      )}
      {a.unknowns.length > 0 && (
        <div className="answer-block unknown">
          <h3>Still unknown</h3>
          <ul>
            {a.unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}
      {a.notes.map((n) => (
        <Alert key={n} tone={a.status === "unsupported" ? "info" : "warn"}>
          {n}
        </Alert>
      ))}
      <div className="answer-foot">
        <span className="muted text-sm">
          {a.sources.length ? `Sources: ${a.sources.map((s) => `${s.id} v${s.version}`).join(" · ")}` : "No records were read."} · nothing was changed
        </span>
        <Link className="link text-sm" href={`/agents?run=${a.runId}`} data-testid="ask-trace">
          <Cpu size={14} aria-hidden="true" /> View trace <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
