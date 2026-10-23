"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, Ellipsis, LayoutDashboard, LogOut, Maximize2, Minimize2, Scale, ShieldCheck, Workflow } from "lucide-react";
import { formatIstStamp, istParts, toMs } from "@/lib/core/time";
import { Brand } from "./brand";
import { useWorkspace } from "./workspace";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/decisions", label: "Decision studio", icon: Scale },
  { href: "/agents", label: "Agent activity", icon: Workflow },
  { href: "/trust", label: "Trust center", icon: ShieldCheck },
];

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function Sidebar() {
  const pathname = usePathname();
  const { ws, logout } = useWorkspace();
  const [menu, setMenu] = useState(false);
  const ref = useDismiss(menu, () => setMenu(false));
  const initials = ws.student.name
    .split(" ")
    .map((p) => p[0])
    .join("");
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <Brand />
      <div className="workspace">
        <span className="avatar">{initials[0]}</span>
        <div>
          <strong>{ws.student.name.split(" ")[0]}&apos;s workspace</strong>
          <small>Sample student profile</small>
        </div>
      </div>
      <div className="side-label">Workspace</div>
      <nav>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`nav-item ${pathname === href ? "active" : ""}`} aria-current={pathname === href ? "page" : undefined}>
            <Icon size={18} strokeWidth={1.8} /> {label}
          </Link>
        ))}
      </nav>
      <div className="side-label spaced">Connected sources</div>
      <div className="source">
        <span className="source-dot dot-sky" />
        <div>
          Academic simulator<small>Demo data · Read-only</small>
        </div>
        <span className="state" title="Synthetic records loaded">
          <Check size={15} strokeWidth={2.4} />
        </span>
      </div>
      <div className="source">
        <span className="source-dot dot-violet" />
        <div>
          Opportunities<small>Curated example event</small>
        </div>
        <span className="state" title="Fictional listing loaded">
          <Check size={15} strokeWidth={2.4} />
        </span>
      </div>
      <div className="source off">
        <span className="source-dot dot-off" />
        <div>
          VTOP<small>Not connected</small>
        </div>
        <span className="state">OFF</span>
      </div>
      <div className="side-account" ref={ref}>
        <button className="side-account-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
          <span className="avatar">{initials}</span>
          <div>
            <strong>{ws.student.name}</strong>
            <small>Fictional student</small>
          </div>
          <Ellipsis size={16} />
        </button>
        {menu && (
          <div className="menu" role="menu">
            <div className="menu-meta">
              <strong>Sample login session</strong>
              Issued by the server for the fictional profile only. httpOnly cookie; no university credentials.
            </div>
            <button className="menu-item" role="menuitem" onClick={logout}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function Topbar() {
  const pathname = usePathname();
  const { ws, pitch, togglePitch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = NAV.find((n) => n.href === pathname)?.label ?? "Overview";
  const d = istParts(toMs(ws.scenario.asOf));
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const revisions = ws.mission?.revisions.filter((r) => r.trigger !== "initial") ?? [];
  return (
    <header className="topbar">
      <div className="crumb">
        <span className="crumb-root" style={{ margin: 0, color: "inherit" }}>
          Student workspace
        </span>
        <span>/</span>
        <strong>{current}</strong>
      </div>
      <div className="top-actions" ref={ref}>
        <span className="pill pill-demo" title="Synthetic student, event, records and policy">
          <span className="live-dot" /> CONTROLLED DEMO
        </span>
        <span className="pill pill-mode" title="No language model is configured; agents run as a deterministic workflow">
          OFFLINE PLANNER
        </span>
        <span className="today" title="Scenario clock used for planning (data as of)">
          {d.day} {MONTHS[d.month - 1]} {d.year}
        </span>
        <button className="round-btn" onClick={togglePitch} aria-pressed={pitch} aria-label="Toggle presentation mode (P)" title="Presentation mode (P)">
          {pitch ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button className="round-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Notifications" title="Plan notifications">
          <Bell size={14} />
          {revisions.length > 0 && <span className="badge-dot" />}
        </button>
        {open && (
          <div className="menu" role="dialog" aria-label="Notifications">
            <div className="menu-meta">
              <strong>Plan notifications</strong>
              Raised by the server when a source record changes. No push or email channels are enabled.
            </div>
            {revisions.length === 0 && ws.notifications.length === 0 && <div className="notif">Nothing yet. Source changes and plan revisions appear here.</div>}
            {[...revisions].reverse().map((r) => (
              <div className="notif" key={r.revision}>
                <strong>
                  Plan revised to revision {r.revision} ({r.trigger === "source_update" ? "source change" : "recalculation"})
                </strong>
                <small>{formatIstStamp(r.createdAt)} IST · previous approval invalidated if one existed</small>
              </div>
            ))}
            {ws.notifications.map((n) => (
              <div className="notif" key={n.id}>
                <strong>{n.title}</strong>
                <small>{formatIstStamp(n.at)} IST · {n.detail}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="application">
      <Sidebar />
      <main className="main" id="main">
        <Topbar />
        {children}
      </main>
    </div>
  );
}

