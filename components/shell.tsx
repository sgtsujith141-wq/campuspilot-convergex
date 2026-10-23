"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronsUpDown, House, ListTree, LogOut, Maximize2, Minimize2, Play, Scale, ShieldCheck } from "lucide-react";
import { formatIstStamp, formatIstWeekday } from "@/lib/core/time";
import { courseInitials } from "@/lib/present";
import { Brand, BrandMark } from "./ui";
import { useWorkspace } from "./workspace";

const NAV = [
  { href: "/overview", label: "Home", icon: House },
  { href: "/decisions", label: "Decisions", icon: Scale },
  { href: "/agents", label: "Activity", icon: ListTree },
  { href: "/trust", label: "Security", icon: ShieldCheck },
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

function ProfileMenu() {
  const { ws, logout } = useWorkspace();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <div className="profile" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="avatar" aria-hidden="true">
          {courseInitials(ws.student.name)}
        </span>
        <span className="who">
          <strong>{ws.student.name}</strong>
          <span>Fictional sample profile</span>
        </span>
        <ChevronsUpDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-info">
            <strong>Sample login session</strong>
            Issued by the server for this fictional profile only.{ws.session.expiresAt ? ` Expires ${formatIstStamp(ws.session.expiresAt)} IST.` : ""}
          </div>
          <a className="menu-item" role="menuitem" href="/overview?intro=1">
            <Play size={15} aria-hidden="true" /> Play presentation intro
          </a>
          <button className="menu-item" role="menuitem" onClick={logout}>
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <Brand />
      <nav className="nav" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            <Icon size={17} aria-hidden="true" /> {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="sources" aria-label="Data sources">
          <strong>Sources</strong>
          <div className="row">
            <span className="dot" aria-hidden="true" /> Academic simulator (demo)
          </div>
          <div className="row">
            <span className="dot" aria-hidden="true" /> Curated event listing
          </div>
          <div className="row">
            <span className="dot off" aria-hidden="true" /> VTOP — not connected
          </div>
        </div>
        <ProfileMenu />
      </div>
    </aside>
  );
}

function Notifications() {
  const { ws } = useWorkspace();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const revisions = (ws.mission?.revisions ?? []).filter((r) => r.trigger !== "initial").reverse();
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={revisions.length ? `Plan updates, ${revisions.length} total` : "Plan updates"}>
        <Bell size={17} aria-hidden="true" />
        {revisions.length > 0 && (
          <span className="count" aria-hidden="true">
            {revisions.length}
          </span>
        )}
      </button>
      {open && (
        <div className="menu" role="dialog" aria-label="Plan updates">
          <div className="menu-info">
            <strong>Plan updates</strong>
            Created by the server when a source record changes. No email or push channels exist.
          </div>
          {revisions.length === 0 && <div className="notice">No updates yet.</div>}
          {revisions.map((r) => (
            <div className="notice" key={r.revision}>
              <Link href="/decisions#plan-update" onClick={close}>
                <strong>Plan revised to revision {r.revision}</strong>
                {r.trigger === "source_update" ? "An academic source changed" : "Re-evaluated against newer sources"} · {formatIstStamp(r.createdAt)} IST
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Topbar() {
  const pathname = usePathname();
  const { ws, pitch, togglePitch } = useWorkspace();
  const current = NAV.find((n) => n.href === pathname)?.label ?? "Home";
  return (
    <header className="topbar">
      <div className="where">
        <strong>{current}</strong>
      </div>
      <div className="mobile-brand">
        <BrandMark size={20} /> CampusPilot
      </div>
      <div className="top-actions">
        <span className="demo-label" title="Synthetic student, event, records and policy">
          Demo data
        </span>
        <span className="scenario-date" title="Planning uses this scenario clock so the demo is reproducible">
          Scenario: {formatIstWeekday(ws.scenario.asOf)}
        </span>
        <Notifications />
        <button className="icon-btn" onClick={togglePitch} aria-pressed={pitch} aria-label="Presentation mode (P)" title="Presentation mode (P)">
          {pitch ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}

function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Main (mobile)">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          <Icon size={19} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <Sidebar />
      <div className="main">
        <Topbar />
        <main id="content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
