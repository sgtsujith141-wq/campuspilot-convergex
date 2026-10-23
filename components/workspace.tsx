"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { OptionId } from "@/lib/contracts";
import type { ApiErrorBody, TaskView, WorkspaceSnapshot } from "@/lib/views";
import { cx } from "./ui";

type Tone = "info" | "success" | "error";
type Action = "evaluate" | "approve" | "source" | "recalculate" | "reset";
type CallResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string; message: string };
export type ActionError = { action: Action; code: string; message: string };

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
    return { ok: false, status: 0, error: "NETWORK", message: "CampusPilot's local server did not respond. Check that it is still running, then try again." };
  }
}

type Ctx = {
  ws: WorkspaceSnapshot;
  busy: Action | null;
  error: ActionError | null;
  clearError: () => void;
  selected: OptionId;
  setSelected: (o: OptionId) => void;
  toast: (message: string, tone?: Tone) => void;
  refresh: () => Promise<void>;
  evaluate: (opportunityId: string) => Promise<boolean>;
  approve: (optionId: OptionId) => Promise<boolean>;
  sourceChange: (event: "advance_assignment_deadline" | "restore_assignment_deadline") => Promise<boolean>;
  recalculate: () => Promise<boolean>;
  reset: () => Promise<boolean>;
  logout: () => Promise<void>;
  pitch: boolean;
  togglePitch: () => void;
  readBack: { at: string; count: number; revision: number } | null;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside provider");
  return ctx;
}

export function WorkspaceProvider({ initial, children }: { initial: WorkspaceSnapshot; children: React.ReactNode }) {
  const [ws, setWs] = useState(initial);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [chosen, setChosen] = useState<OptionId | null>(null);
  const [toastState, setToastState] = useState<{ message: string; tone: Tone; id: number } | null>(null);
  const [pitch, setPitch] = useState(false);
  const [readBack, setReadBack] = useState<Ctx["readBack"]>(null);
  const mutationCounter = useRef(0);
  const busyRef = useRef<Action | null>(null);

  const toast = useCallback((message: string, tone: Tone = "info") => setToastState({ message, tone, id: Date.now() }), []);
  useEffect(() => {
    if (!toastState) return;
    const t = window.setTimeout(() => setToastState(null), 4500);
    return () => window.clearTimeout(t);
  }, [toastState]);

  const load = useCallback(async (guard?: number) => {
    const res = await call<WorkspaceSnapshot>("/api/workspace");
    if (guard !== undefined && guard !== mutationCounter.current) return; // a mutation landed meanwhile
    if (res.ok) setWs(res.data);
    else if (res.status === 401) window.location.assign("/overview?session=expired");
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
    async <T,>(action: Action, url: string, body: unknown, onOk: (data: T) => void | Promise<void>): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = action;
      setBusy(action);
      mutationCounter.current += 1;
      try {
        const res = await call<T>(url, body);
        if (res.ok) {
          setError(null);
          await load();
          await onOk(res.data);
          return true;
        }
        if (res.status === 401) {
          window.location.assign("/overview?session=expired");
          return false;
        }
        // A stale plan is refreshed so the student immediately sees what changed.
        if (res.status === 409 || res.status === 422) await load();
        setError({ action, code: res.error, message: res.message });
        toast(res.message, "error");
        return false;
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
    (opportunityId: string) =>
      mutate<{ created: boolean; mission: { revision: number } }>("evaluate", "/api/mission/evaluate", { missionType: "event_participation", opportunityId }, (d) => {
        setChosen(null);
        toast(d.created ? "Evaluation complete — three options compared from your records" : "This decision was already evaluated; showing the saved plan", "success");
      }),
    [mutate, toast],
  );

  const approve = useCallback(
    async (optionId: OptionId) => {
      if (!mission) return false;
      const drafts = mission.drafts[optionId];
      const nonce = Math.random().toString(36).slice(2, 10);
      const revision = mission.revision;
      return mutate<{ tasks: TaskView[]; replayed: boolean }>(
        "approve",
        `/api/mission/${mission.id}/approve`,
        { revision, optionId, actionIds: drafts.map((d) => d.id), challenge: mission.challenge, idempotencyKey: `apr-${revision}-${optionId}-${nonce}` },
        async (d) => {
          // Read back from the server rather than trusting the write response.
          const check = await call<{ tasks: TaskView[] }>("/api/tasks");
          const count = check.ok ? check.data.tasks.filter((t) => t.status === "active").length : 0;
          setReadBack({ at: new Date().toISOString(), count, revision });
          toast(d.replayed ? "Already approved — no duplicate tasks were created" : `Plan approved · ${count} tasks saved and read back from the server`, "success");
        },
      );
    },
    [mission, mutate, toast],
  );

  const sourceChange = useCallback(
    (event: "advance_assignment_deadline" | "restore_assignment_deadline") =>
      mutate<{ changed: boolean; version: number; replans: { fromRevision: number; toRevision: number; invalidatedApprovals: number }[] }>(
        "source",
        "/api/demo/source-change",
        { event },
        (d) => {
          setReadBack(null);
          const r = d.replans[0];
          if (!d.changed) toast("The source already has that value — nothing to re-plan");
          else if (!r) toast(`Source record saved as version ${d.version}. No plan depends on it yet.`);
          else toast(`Deadline changed → plan revised to revision ${r.toRevision}${r.invalidatedApprovals ? "; your earlier approval needs review" : ""}`, "success");
        },
      ),
    [mutate, toast],
  );

  const recalculate = useCallback(async () => {
    if (!mission) return false;
    return mutate<{ changed: boolean; toRevision: number }>("recalculate", `/api/mission/${mission.id}/recalculate`, {}, (d) =>
      toast(d.changed ? `Sources changed — plan updated to revision ${d.toRevision}` : `Re-ran the evaluation: revision ${d.toRevision} still matches your records`, "success"),
    );
  }, [mission, mutate, toast]);

  const reset = useCallback(
    () =>
      mutate("reset", "/api/demo/reset", {}, () => {
        setChosen(null);
        setReadBack(null);
        toast("Demo reset to the seed scenario", "success");
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
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector("[role=dialog]")) return;
      togglePitch();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [togglePitch]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<Ctx>(
    () => ({ ws, busy, error, clearError, selected, setSelected: setChosen, toast, refresh, evaluate, approve, sourceChange, recalculate, reset, logout, pitch, togglePitch, readBack }),
    [ws, busy, error, clearError, selected, toast, refresh, evaluate, approve, sourceChange, recalculate, reset, logout, pitch, togglePitch, readBack],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      <div className={cx("toast", toastState && "show", toastState?.tone === "error" && "error")} role="status" aria-live="polite">
        {toastState?.tone === "success" ? <CircleCheck size={16} /> : toastState?.tone === "error" ? <CircleAlert size={16} /> : <Info size={16} />}
        <span>{toastState?.message}</span>
      </div>
    </WorkspaceContext.Provider>
  );
}
