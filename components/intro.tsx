"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "./ui";

// Presentation opening for /overview?intro=1. The real Home screen is already rendered underneath;
// this overlay plays four short stages and then fades away. Esc / Enter / Space / S skip it.
const DURATIONS = [4300, 4300, 4700, 4700];
const LINES = ["Information is everywhere.", "Decisions are still disconnected.", "What if AI understood the whole situation?"];
const CENTER = { x: 450, y: 210 };
const NODES = [
  { label: "Attendance", x: 170, y: 110 },
  { label: "Deadlines", x: 730, y: 100 },
  { label: "Events", x: 790, y: 300 },
  { label: "Timetable", x: 120, y: 300 },
  { label: "Approvals", x: 450, y: 40 },
];

export function Intro() {
  const [stage, setStage] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  const finish = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setGone(true), 900);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    let i = 0;
    let timer = window.setTimeout(function next() {
      if (i < DURATIONS.length - 1) {
        i += 1;
        setStage(i);
        timer = window.setTimeout(next, DURATIONS[i]);
      } else finish();
    }, DURATIONS[0]);
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "Enter", " ", "s", "S"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, [finish]);

  if (gone) return null;
  return (
    <div className={`intro${leaving ? " leaving" : ""}`} data-stage={stage} data-testid="intro" role="dialog" aria-label="CampusPilot introduction" aria-live="polite">
      <div className="intro-stage">
        <svg className="intro-svg" viewBox="0 0 900 480" aria-hidden="true">
          {NODES.map((n) => {
            const dx = CENTER.x - n.x;
            const dy = CENTER.y - n.y;
            return (
              <g key={n.label}>
                <path className="intro-broken" d={`M ${n.x} ${n.y} L ${n.x + dx * 0.45} ${n.y + dy * 0.45}`} />
                <path className="intro-line" d={`M ${n.x} ${n.y} L ${CENTER.x} ${CENTER.y}`} />
                <g className="intro-node" style={{ ["--tx" as string]: `${dx}px`, ["--ty" as string]: `${dy}px`, transformBox: "fill-box", transformOrigin: "center" }}>
                  <rect x={n.x - 62} y={n.y - 17} width="124" height="34" rx="17" />
                  <text x={n.x} y={n.y + 4.5} textAnchor="middle">
                    {n.label}
                  </text>
                </g>
              </g>
            );
          })}
          <g className="intro-core">
            <circle cx={CENTER.x} cy={CENTER.y} r="26" fill="none" stroke="#4fb3ab" strokeOpacity="0.5" />
            <circle cx={CENTER.x} cy={CENTER.y} r="6" fill="#4fb3ab" />
          </g>
        </svg>
        <div className="intro-copy">
          {LINES.map((l, i) => (
            <p key={l} className={`intro-line-text${stage === i ? " show" : ""}`} style={{ position: "absolute", left: 0, right: 0 }} aria-hidden={stage !== i}>
              {l}
            </p>
          ))}
        </div>
        <div className="intro-brand" aria-hidden={stage !== 3}>
          <div>
            <BrandMark size={56} />
            <span className="tag">Introducing</span>
            <span className="wordmark">CampusPilot</span>
            <span className="tag">Evidence-backed decisions for students.</span>
          </div>
        </div>
      </div>
      <div className="intro-progress" aria-hidden="true">
        {DURATIONS.map((d, i) => (
          <span key={i} className={i < stage ? "done" : i === stage ? "active" : ""} style={{ ["--seg" as string]: `${d}ms` }}>
            <i />
          </span>
        ))}
      </div>
      <button className="intro-skip" onClick={finish} data-testid="intro-skip">
        Skip intro (Esc)
      </button>
    </div>
  );
}
