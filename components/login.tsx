"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { Alert, Brand, Spinner } from "./ui";

export function SampleLogin() {
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const [expired, setExpired] = useState(false);
  useEffect(() => setExpired(new URLSearchParams(window.location.search).get("session") === "expired"), []);
  const signIn = async () => {
    setState("pending");
    try {
      const res = await fetch("/api/session/sample", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error(String(res.status));
      window.location.assign("/overview");
    } catch {
      setState("error");
    }
  };
  return (
    <main className="login">
      <div className="login-card">
        <Brand />
        {expired && <Alert tone="warn">Your session ended. Open the sample workspace again to continue.</Alert>}
        <h1>Sign in to the demo workspace</h1>
        <p>This demo uses a fictional student and a fictional event. CampusPilot never asks for a university login, VTOP credentials or real academic records.</p>
        <div className="login-profile">
          <span className="avatar" aria-hidden="true">
            MR
          </span>
          <div>
            <strong>Maya Rao</strong>
            <span>Fictional student · sample campus</span>
          </div>
        </div>
        <button className="btn btn-primary btn-lg btn-block" onClick={signIn} disabled={state === "pending"}>
          {state === "pending" ? <Spinner /> : null}
          {state === "pending" ? "Starting session…" : "Open Maya's sample workspace"}
          {state !== "pending" && <ArrowRight size={16} aria-hidden="true" />}
        </button>
        {state === "error" && (
          <div style={{ marginTop: "1rem" }}>
            <Alert tone="bad" role="alert">
              The server refused the sample login. Check that demo mode is on and the server is running.
            </Alert>
          </div>
        )}
        <p className="login-foot">
          <Lock size={14} aria-hidden="true" /> The server issues a session for this one fictional profile and accepts no identity input. The cookie is httpOnly and SameSite=Strict.
        </p>
      </div>
    </main>
  );
}
