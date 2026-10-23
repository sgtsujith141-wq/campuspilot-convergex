"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import type { OptionId } from "@/lib/contracts";
import type { ApiErrorBody, TaskView, WorkspaceSnapshot } from "@/lib/views";

type Tone = "info" | "success" | "error";
type CallResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string; message: string };

export const MISSION_GOAL =
  "Can I attend CyberForge Sprint on Oct 29–30? Check attendance, assessments, assignments, and prepare a realistic plan.";

async function call<T>(url: string, body?: unknown): Promise<CallResult<T>> {
  try {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    const err = data as Partial<ApiErrorBody>;
    return { ok: false, status: res.status, error: err.error ?? "HTTP_ERROR", message: err.message ?? `Request failed (${res.status})` };
  } catch {
    return { ok: false, status: 0, error: "NETWORK", message: "The local server did not respond. Is `npm run dev` still running?" };
  }
}

type Ctx = {
  ws: WorkspaceSnapshot;
  busy: string | null;
  selected: OptionId;
  setSelected: (o: OptionId) => void;
  toast: (message: string, tone?: Tone) => void;
  refresh: () => Promise<void>;
  evaluate: () => Promise<void>;
  approve: (optionId: OptionId) => Promise<void>;
  sourceChange: (event: "advance_assignment_deadline" | "restore_assignment_deadline") => Promise<void>;
  recalculate: () => Promise<void>;
  reset: () => Promise<void>;
  logout: () => Promise<void>;
  pitch: boolean;
  togglePitch: () => void;
  lastApprovalReadBack: { at: string; count: number } | null;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside provider");
  return ctx;
}

export function WorkspaceProvider({ initial, children }: { initial: WorkspaceSnapshot; children: React.ReactNode }) {
  const [ws, setWs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [chosen, setChosen] = useState<OptionId | null>(null);
  const [toastState, setToastState] = useState<{ message: string; tone: Tone; id: number } | null>(null);
  const [pitch, setPitch] = useState(false);
  const [lastApprovalReadBack, setReadBack] = useState<{ at: string; count: number } | null>(null);
  const mutationCounter = useRef(0);
  const busyRef = useRef<string | null>(null);

  const toast = useCallback((message: string, tone: Tone = "info") => setToastState({ message, tone, id: Date.now() }), []);
  useEffect(() => {
    if (!toastState) return;
    const t = window.setTimeout(() => setToastState(null), 4200);
    return () => window.clearTimeout(t);
  }, [toastState]);

  const load = useCallback(async (guard?: number) => {
    const res = await call<WorkspaceSnapshot>("/api/workspace");
    if (guard !== undefined && guard !== mutationCounter.current) return; // a mutation landed meanwhile
    if (res.ok) setWs(res.data);
    else if (res.status === 401) window.location.reload();
  }, []);

  const refresh = useCallback(() => load(), [load]);

  // Light polling keeps the view honest if the server changes state from another tab.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busyRef.current) void load(mutationCounter.current);
    }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const mutate = useCallback(
    async <T,>(key: string, url: string, body: unknown, onOk: (data: T) => void | Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = key;
      setBusy(key);
      mutationCounter.current += 1;
      try {
        const res = await call<T>(url, body);
        if (res.ok) {
          await load();
          await onOk(res.data);
        } else {
          if (res.status === 409) await load();
          toast(res.message, "error");
        }
      } finally {
        busyRef.current = null;
        setBusy(null);
      }
    },
    [load, toast],
  );

  const mission = ws.mission;
  const selected: OptionId = chosen ?? mission?.approval?.optionId ?? mission?.result.recommendation.optionId ?? "partial";

  const evaluate = useCallback(
    () =>
      mutate<{ created: boolean; mission: { revision: number } }>("evaluate", "/api/mission/evaluate", { missionType: "event_participation", opportunityId: ws.opportunity.id }, (d) => {
        setChosen(null);
        toast(d.created ? `Evidence gathered and options computed · revision ${d.mission.revision} saved` : "Mission already exists — showing the saved plan", "success");
      }),
    [mutate, toast, ws.opportunity.id],
  );

  const approve = useCallback(
    async (optionId: OptionId) => {
      if (!mission) return;
      const drafts = mission.drafts[optionId];
      const nonce = Math.random().toString(36).slice(2, 10);
      await mutate<{ tasks: TaskView[]; replayed: boolean }>(
        "approve",
        `/api/mission/${mission.id}/approve`,
        {
          revision: mission.revision,
          optionId,
          actionIds: drafts.map((d) => d.id),
          challenge: mission.challenge,
          idempotencyKey: `apr-${mission.revision}-${optionId}-${nonce}`,
        },
        async (d) => {
          // Read back from the server rather than trusting the write response.
          const check = await call<{ tasks: TaskView[] }>("/api/tasks");
          const live = check.ok ? check.data.tasks.filter((t) => t.status === "active").length : 0;
          setReadBack({ at: new Date().toISOString(), count: live });
          toast(d.replayed ? "Already approved — no duplicate tasks created" : `Approved revision ${mission.revision} · ${live} tasks saved and read back from the server`, "success");
        },
      );
    },
    [mission, mutate, toast],
  );

  const sourceChange = useCallback(
    (event: "advance_assignment_deadline" | "restore_assignment_deadline") =>
      mutate<{ changed: boolean; version: number; replans: { fromRevision: number; toRevision: number; changed: boolean; invalidatedApprovals: number }[] }>(
        "source",
        "/api/demo/source-change",
        { event },
        (d) => {
          setReadBack(null);
          const r = d.replans[0];
          if (!d.changed) toast("Source already at that value — nothing to replan");
          else if (!r) toast(`Source record saved as v${d.version}. No dependent plan yet — ask CampusPilot first.`);
          else
            toast(
              `Source v${d.version} detected → plan revised r${r.fromRevision} → r${r.toRevision}${r.invalidatedApprovals ? " · previous approval invalidated" : ""}`,
              "success",
            );
        },
      ),
    [mutate, toast],
  );

  const recalculate = useCallback(async () => {
    if (!mission) return;
    await mutate<{ changed: boolean; toRevision: number }>("recalculate", `/api/mission/${mission.id}/recalculate`, {}, (d) =>
      toast(d.changed ? `Sources changed → plan updated to revision ${d.toRevision}` : `Re-ran the workflow: revision ${d.toRevision} still matches current sources`, "success"),
    );
  }, [mission, mutate, toast]);

  const reset = useCallback(
    () =>
      mutate("reset", "/api/demo/reset", {}, () => {
        setChosen(null);
        setReadBack(null);
        toast("Controlled demo restored to the seed scenario", "success");
      }),
    [mutate, toast],
  );

  const logout = useCallback(async () => {
    await call("/api/session/logout", {});
    window.location.assign("/overview");
  }, []);

  const togglePitch = useCallback(() => {
    setPitch((p) => {
      document.documentElement.classList.toggle("pitch-mode", !p);
      return !p;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== "p" || e.altKey || e.ctrlKey || e.metaKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      togglePitch();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [togglePitch]);

  const value = useMemo<Ctx>(
    () => ({ ws, busy, selected, setSelected: setChosen, toast, refresh, evaluate, approve, sourceChange, recalculate, reset, logout, pitch, togglePitch, lastApprovalReadBack }),
    [ws, busy, selected, toast, refresh, evaluate, approve, sourceChange, recalculate, reset, logout, pitch, togglePitch, lastApprovalReadBack],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      <div className={`toast ${toastState ? "show" : ""} ${toastState?.tone ?? ""}`} role="status" aria-live="polite">
        {toastState?.tone === "success" ? <CircleCheck size={16} /> : toastState?.tone === "error" ? <CircleAlert size={16} /> : <Info size={16} />}
        <span>{toastState?.message}</span>
      </div>
    </WorkspaceContext.Provider>
  );
}

export function Modal({ open, onClose, eyebrow, title, children, footer }: { open: boolean; onClose: () => void; eyebrow: string; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <div className="eyebrow">{eyebrow}</div>
        <h2 id="modal-title">{title}</h2>
        {children}
        {footer ?? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
