"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { BrandMark } from "./ui";

// Presentation opening for /overview?intro=1. The real Home screen is already rendered underneath;
// this overlay plays a 30-second sequence and then fades away. Every step is timed with CSS animation
// delays (--d in, --o out), so it replays on each load. Esc / Enter / Space / S skip it.
// Figures come from the synthetic demo scenario and are labelled as sample projections.
const TOTAL_MS = 30_000;
const REDUCED_MS = 5_000;

const css = (vars: Record<string, string | number>) => vars as CSSProperties;

// Stage positions are percentages of a 16:9 stage; the SVG layer uses the same space as 1600 × 900.
// p2: scene 2 (around the event) · p3: scene 3 (above the timeline) · p4: scene 4 (evidence column).
const CARDS = [
  { key: "att", label: "Attendance", title: "Network Security", lines: ["21 of 27 classes · 77.8%"], meter: 77.8, d: 7.0, from: ["-7cqw", "0cqw"], p2: [17, 25], p3: [17, 13], p4: [14, 32] },
  { key: "tt", label: "Timetable", title: "Scheduled classes", lines: ["Thu 29 · CS201 Lecture, CS203 Lab", "Fri 30 · CS201 Lab"], d: 7.5, from: ["0cqw", "-6cqw"], p2: [83, 25], p3: [83, 13], p4: [14, 44] },
  { key: "dl", label: "Deadlines", title: "Database mini-project", lines: ["Due Thu, Oct 29 · 6:00 PM"], d: 8.0, from: ["7cqw", "0cqw"], p2: [83, 67], p3: [83, 33], p4: [14, 56] },
  { key: "as", label: "Assessments", title: "Network Security assessment", lines: ["Sat, Oct 31 · 9:00 AM"], d: 8.5, from: ["0cqw", "6cqw"], p2: [17, 67], p3: [17, 33], p4: [14, 68] },
] as const;

const STEPS = [
  { n: 1, label: "Evidence", x: 14, d: 20.3 },
  { n: 2, label: "Evaluate", x: 38, d: 21.0 },
  { n: 3, label: "Compare", x: 62, d: 21.8 },
  { n: 4, label: "Plan", x: 86, d: 23.9 },
];

const CHECKS = [
  { text: "Attendance vs sample 75% rule", y: 32, d: 21.3 },
  { text: "Class clashes by time overlap", y: 44, d: 21.5 },
  { text: "Deadline inside the event window", y: 56, d: 21.7 },
  { text: "Registration and verification", y: 68, d: 21.9 },
];

const OPTIONS = [
  { key: "full", name: "Full event", pct: "74.2%", note: "Below the sample 75% rule", warn: true, y: 34, d: 22.3 },
  { key: "sel", name: "Selected sessions", pct: "77.4%", note: "Meets the sample 75% rule", y: 48, d: 22.5, selected: true },
  { key: "defer", name: "Defer", pct: "80.6%", note: "Meets the rule · no participation", y: 62, d: 22.7 },
];

// Timeline (scene 3): Mon Oct 26 00:00 → Sun Nov 1 00:00 mapped onto x = 8% … 92% of the stage.
const tx = (hours: number) => (8 + (84 * hours) / 144) * 16;
const AXIS_Y = 477;
const DAYS = ["Mon 26", "Tue 27", "Wed 28", "Thu 29", "Fri 30", "Sat 31"];
const CLASSES = [83, 86, 107]; // Thu 11:00, Thu 14:00, Fri 11:00
const EVENT = [82, 113]; // Thu 10:00 → Fri 17:00
const DEADLINE = 90; // Thu 18:00
const ASSESSMENT = 129; // Sat 09:00

export function Intro() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  const finish = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setGone(true), 900);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finish, reduce ? REDUCED_MS : TOTAL_MS);
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
    <div className={`intro${leaving ? " leaving" : ""}`} data-testid="intro" role="dialog" aria-label="CampusPilot introduction">
      <p className="sr-only">
        AI can answer almost any question, but can it understand the consequences of a decision? A student weighs a two-day hackathon against attendance, classes, a
        deadline and an assessment. The information exists, but nothing connects it. CampusPilot gathers the evidence, evaluates it, compares the options and proposes a
        plan.
      </p>
      <div className="ix-stage" aria-hidden="true">
        {/* Scene 1 — the question */}
        <span className="ix ix-glow" style={css({ "--x": "50%", "--y": "34%", "--d": "0.2s", "--o": "5.8s" })} />
        <p className="ix ix-h ix-lg" style={css({ "--x": "50%", "--y": "50%", "--d": "0.9s", "--o": "2.9s" })}>
          AI can answer almost any question.
        </p>
        <p className="ix ix-h" style={css({ "--x": "50%", "--y": "50%", "--d": "3.6s", "--o": "5.5s" })}>
          But can it understand the <em>consequences</em> of a decision?
        </p>

        {/* Scenes 2–4 — synthetic records */}
        <span className="ix ix-left ix-tag" style={css({ "--x": "0%", "--y": "2%", "--d": "6.4s", "--o": "26.0s" })}>
          Synthetic sample scenario · not live university data
        </span>

        <svg className="ix-svg" viewBox="0 0 1600 900" preserveAspectRatio="none">
          {/* Scene 2: records stay disconnected — dashed stubs stop short of the event */}
          <g className="ix-s" style={css({ "--d": "9.2s", "--o": "12.8s" })}>
            <path className="ix-stub" d="M 440 240 L 560 300" />
            <path className="ix-stub" d="M 1160 240 L 1040 300" />
            <path className="ix-stub" d="M 1160 590 L 1040 540" />
            <path className="ix-stub" d="M 440 590 L 560 540" />
          </g>

          {/* Scene 3: the conflict on a timeline */}
          <g className="ix-s" style={css({ "--d": "13.3s", "--o": "19.8s" })}>
            <rect className="ix-band ix-s2" style={css({ "--d": "14.6s" })} x={tx(EVENT[0])} y="428" width={tx(EVENT[1]) - tx(EVENT[0])} height="98" rx="8" />
            <text className="ix-band-label ix-s2" style={css({ "--d": "14.8s" })} x={(tx(EVENT[0]) + tx(EVENT[1])) / 2} y="412">
              CyberForge Sprint · Oct 29–30
            </text>
            <line className="ix-line ix-axis" style={css({ "--d": "13.5s" })} pathLength={1} x1="128" y1={AXIS_Y} x2="1472" y2={AXIS_Y} />
            <g className="ix-s2" style={css({ "--d": "14.1s" })}>
              {[0, 24, 48, 72, 96, 120, 144].map((h) => (
                <line key={h} className="ix-tick" x1={tx(h)} y1={AXIS_Y - 7} x2={tx(h)} y2={AXIS_Y + 7} />
              ))}
              {DAYS.map((d, i) => (
                <text key={d} className="ix-day" x={tx(i * 24 + 12)} y="553">
                  {d}
                </text>
              ))}
            </g>
            {CLASSES.map((h, i) => (
              <g key={h}>
                <circle className="ix-halo" style={css({ "--d": `${16.6 + i * 0.1}s` })} cx={tx(h)} cy={AXIS_Y} r="15" />
                <rect className="ix-class ix-s2" style={css({ "--d": `${15.1 + i * 0.2}s` })} x={tx(h) - 3.5} y={AXIS_Y - 14} width="7" height="28" rx="3" />
              </g>
            ))}
            <text className="ix-warn-label ix-s2" style={css({ "--d": "15.7s" })} x={(tx(EVENT[0]) + tx(EVENT[1])) / 2} y="603">
              3 classes clash
            </text>
            <rect className="ix-dl ix-s2" style={css({ "--d": "15.9s" })} x={tx(DEADLINE) - 8} y={AXIS_Y - 8} width="16" height="16" transform={`rotate(45 ${tx(DEADLINE)} ${AXIS_Y})`} />
            <text className="ix-warn-label ix-s2" style={css({ "--d": "16.1s" })} x={tx(DEADLINE)} y="648">
              Mini-project due · Oct 29, 6 PM
            </text>
            <circle className="ix-as ix-s2" style={css({ "--d": "16.3s" })} cx={tx(ASSESSMENT)} cy={AXIS_Y} r="8" />
            <text className="ix-muted-label ix-s2" style={css({ "--d": "16.5s" })} x={tx(ASSESSMENT)} y="603">
              Assessment · Oct 31, 9 AM
            </text>
            {/* Where each fact comes from — these links break when "nothing connects it" appears */}
            <g className="ix-s" style={css({ "--d": "16.7s", "--o": "18.4s" })}>
              <path className="ix-leader" d={`M 800 242 C 800 330, ${(tx(EVENT[0]) + tx(EVENT[1])) / 2} 330, ${(tx(EVENT[0]) + tx(EVENT[1])) / 2} 426`} />
              <path className="ix-leader" d={`M 1196 130 C 1060 160, ${tx(CLASSES[1])} 300, ${tx(CLASSES[1])} 460`} />
              <path className="ix-leader" d={`M 1196 300 C 1080 330, ${tx(DEADLINE)} 380, ${tx(DEADLINE)} 462`} />
            </g>
          </g>

          {/* Scene 4: the pipeline forms */}
          <g className="ix-s" style={css({ "--d": "20.2s", "--o": "26.0s" })}>
            {[
              [330, 500, 20.7],
              [714, 884, 21.5],
              [1098, 1268, 23.6],
            ].map(([x1, x2, d]) => (
              <g key={x1}>
                <line className="ix-line" style={css({ "--d": `${d}s` })} pathLength={1} x1={x1} y1="153" x2={x2 - 6} y2="153" />
                <path className="ix-arrow ix-s2" style={css({ "--d": `${d + 0.7}s` })} d={`M ${x2 - 12} 146 L ${x2} 153 L ${x2 - 12} 160 z`} />
              </g>
            ))}
            {CHECKS.map((c, i) => (
              <line key={c.text} className="ix-line thin" style={css({ "--d": `${21.2 + i * 0.2}s` })} pathLength={1} x1="326" y1={c.y * 9} x2="450" y2={c.y * 9} />
            ))}
            {OPTIONS.map((o) => (
              <path key={o.key} className="ix-line thin" style={css({ "--d": "22.3s" })} pathLength={1} d={`M 765 450 C 805 450, 805 ${o.y * 9}, 843 ${o.y * 9}`} />
            ))}
            <line className="ix-line" style={css({ "--d": "24.0s" })} pathLength={1} x1="1140" y1="432" x2="1236" y2="432" />
            <path className="ix-arrow ix-s2" style={css({ "--d": "24.7s" })} d="M 1230 425 L 1242 432 L 1230 439 z" />
          </g>
        </svg>

        {/* Scene 2: the opportunity */}
        <div className="ix-event" style={css({ "--y2": "46%", "--y3": "20%" })}>
          <span className="lab">Opportunity</span>
          <span className="ttl">CyberForge Sprint</span>
          <span className="when">Oct 29–30</span>
          <span className="det">Two-day hackathon · registration closes Oct 27</span>
        </div>

        <div className="ix-cards">
          {CARDS.map((c) => (
            <div
              key={c.key}
              className="ix-card"
              style={css({
                "--d": `${c.d}s`,
                "--fx": c.from[0],
                "--fy": c.from[1],
                "--x2": `${c.p2[0]}%`,
                "--y2": `${c.p2[1]}%`,
                "--x3": `${c.p3[0]}%`,
                "--y3": `${c.p3[1]}%`,
                "--x4": `${c.p4[0]}%`,
                "--y4": `${c.p4[1]}%`,
              })}
            >
              <span className="lab">{c.label}</span>
              <span className="ttl">{c.title}</span>
              <div className="det">
                {c.lines.map((l) => (
                  <span key={l}>{l}</span>
                ))}
                {"meter" in c && (
                  <div className="ix-meter" style={css({ "--w": `${c.meter}%` })}>
                    <i />
                    <b title="sample 75% rule" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="ix ix-h" style={css({ "--x": "50%", "--y": "90%", "--d": "9.8s", "--o": "12.7s" })}>
          One opportunity. Multiple consequences.
        </p>

        {/* Scene 3: the problem */}
        <p className="ix ix-h" style={css({ "--x": "50%", "--y": "81%", "--d": "17.2s", "--o": "19.7s" })}>
          The information exists.
        </p>
        <p className="ix ix-h ix-lg under" style={css({ "--x": "50%", "--y": "91%", "--d": "18.4s", "--o": "19.8s" })}>
          But nothing connects it.
        </p>

        {/* Scene 4: the intelligence */}
        {STEPS.map((s) => (
          <div key={s.label} className="ix ix-pill" style={css({ "--x": `${s.x}%`, "--y": "17%", "--d": `${s.d}s`, "--o": "26.0s" })}>
            <b>{s.n}</b> {s.label}
          </div>
        ))}
        {CHECKS.map((c) => (
          <div key={c.text} className="ix ix-check" style={css({ "--x": "38%", "--y": `${c.y}%`, "--d": `${c.d}s`, "--o": "26.0s" })}>
            <i /> {c.text}
          </div>
        ))}
        {OPTIONS.map((o) => (
          <div key={o.key} className={`ix ix-opt${"selected" in o ? " sel" : ""}`} style={css({ "--x": "62%", "--y": `${o.y}%`, "--d": `${o.d}s`, "--o": "26.0s" })}>
            <span className="nm">{o.name}</span>
            <span className="pc">{o.pct}</span>
            <span className={`nt${"warn" in o ? " warn" : ""}`}>{o.note}</span>
            {"selected" in o && <span className="rec">Recommended · conditional</span>}
          </div>
        ))}
        <span className="ix ix-cap" style={css({ "--x": "62%", "--y": "72.5%", "--d": "22.6s", "--o": "26.0s" })}>
          Sample scenario projections · Network Security attendance
        </span>
        <div className="ix ix-plan" style={css({ "--x": "86%", "--y": "48%", "--d": "24.2s", "--o": "26.0s" })}>
          <span className="lab">Proposed plan</span>
          <span className="ttl">Attend selected sessions</span>
          <span className="det">Saved as tasks only after the student approves</span>
        </div>
        <p className="ix ix-h" style={css({ "--x": "50%", "--y": "88%", "--d": "23.2s", "--o": "26.0s" })}>
          Connected evidence. <em className="teal">Calculated consequences.</em>
        </p>

        {/* Scene 5: the product */}
        <div className="ix-brand">
          <span className="ix-b mark" style={css({ "--d": "26.5s" })}>
            <BrandMark size={64} />
          </span>
          <span className="ix-b wordmark" style={css({ "--d": "27.0s" })}>
            CampusPilot
          </span>
          <span className="ix-b tagline" style={css({ "--d": "27.6s" })}>
            From disconnected information to evidence-backed decisions.
          </span>
          <span className="ix-b meta" style={css({ "--d": "28.2s" })}>
            Local AI investigation · deterministic planning · your approval before action
          </span>
        </div>
      </div>
      <div className="intro-progress" aria-hidden="true">
        <i />
      </div>
      <button className="intro-skip" onClick={finish} data-testid="intro-skip">
        Skip intro (Esc)
      </button>
    </div>
  );
}
