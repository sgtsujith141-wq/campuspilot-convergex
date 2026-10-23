"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle, Lock } from "lucide-react";
import { Brand } from "./brand";

export function SampleLogin() {
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const signIn = async () => {
    setState("pending");
    try {
      const res = await fetch("/api/session/sample", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error(String(res.status));
      window.location.reload();
    } catch {
      setState("error");
    }
  };
  return (
    <div className="login-shell">
      <div className="login-card">
        <Brand />
        <div className="overline">Controlled demo workspace</div>
        <h1>Open the sample student workspace</h1>
        <p>CampusPilot is shown with a fictional student and a fictional event. No university login, VTOP credentials or real academic records are used or requested.</p>
        <div className="login-profile">
          <span className="avatar">MR</span>
          <div>
            <strong>Maya Rao</strong>
            <small>Fictional student · Sample campus environment</small>
          </div>
        </div>
        <button className="btn btn-primary" onClick={signIn} disabled={state === "pending"}>
          {state === "pending" ? "Starting session…" : "Open Maya's sample workspace"}
          {state === "pending" ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />}
        </button>
        {state === "error" && <div className="inline-warn">The local server refused the sample login. Check that demo mode is on and the server is running.</div>}
        <p className="login-foot">
          <Lock size={13} /> Sample login issues a server session for this one fictional profile and accepts no identity input. Session cookie is httpOnly and SameSite=Strict.
        </p>
      </div>
    </div>
  );
}
