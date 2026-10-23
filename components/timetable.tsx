"use client";

import { useMemo } from "react";
import { formatIstDay, formatIstTime, formatIstWeekday, istDayKey, toMs } from "@/lib/core/time";
import { attendanceWindow, overlappingSessions } from "@/lib/core/timetable";
import { OPTION_LABEL } from "@/lib/present";
import { Badge, cx } from "./ui";
import { useWorkspace } from "./workspace";

/** Compact weekly view of the synthetic timetable, highlighting classes the selected option would miss. */
export function TimetableView() {
  const { ws, selected } = useWorkspace();
  const tt = ws.timetable;
  const days = useMemo(() => {
    if (!tt) return [];
    const map = new Map<string, typeof tt.sessions>();
    for (const s of [...tt.sessions].sort((a, b) => toMs(a.start) - toMs(b.start))) map.set(istDayKey(s.start), [...(map.get(istDayKey(s.start)) ?? []), s]);
    return [...map.entries()];
  }, [tt]);
  if (!tt) return null;
  const event = { start: ws.opportunity.start, end: ws.opportunity.end };
  const window = attendanceWindow(selected, event, tt.partialWindow);
  const clashIds = new Set(overlappingSessions(tt.sessions, window).map((s) => s.id));
  const eventDays = new Set([istDayKey(event.start), istDayKey(event.end)]);
  return (
    <section className="panel" id="timetable" aria-labelledby="tt-title" data-testid="timetable">
      <div className="panel-head">
        <div>
          <h2 id="tt-title" tabIndex={-1}>
            Class timetable
          </h2>
          <div className="sub">
            Highlighted: classes missed if you choose “{OPTION_LABEL[selected]}”{window ? "" : " — none"}.
          </div>
        </div>
        <Badge tone="warn">Synthetic demo timetable</Badge>
      </div>
      <div className="tt-grid">
        {days.map(([key, sessions]) => {
          const d = formatIstDay(sessions[0].start);
          return (
            <div className={cx("tt-day", eventDays.has(key) && "event-day")} key={key}>
              <div className="tt-date">
                <strong>{formatIstWeekday(sessions[0].start).split(",")[0]}</strong> {d.day} {d.month.charAt(0) + d.month.slice(1).toLowerCase()}
                {eventDays.has(key) && <span className="tt-event">Event day</span>}
              </div>
              {sessions.map((s) => {
                const clash = clashIds.has(s.id);
                return (
                  <div className={cx("tt-session", clash && "clash")} key={s.id} data-clash={clash || undefined}>
                    <span className="tt-time">
                      {formatIstTime(s.start)}–{formatIstTime(s.end)}
                    </span>
                    <strong>
                      {s.code} {s.name}
                    </strong>
                    <span className="muted text-xs">
                      {s.type} · {s.room} · {s.instructor}
                    </span>
                    {clash && <span className="tt-clash">Clashes with the event</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="panel-foot text-sm muted">
        Sample records, not VTOP · not institutionally verified · source {tt.sourceId} v{tt.version} ({tt.verification}). Event: full {formatIstWeekday(event.start)}, {formatIstTime(event.start)} – {formatIstWeekday(event.end)}, {formatIstTime(event.end)};
        selected sessions assumed {formatIstWeekday(tt.partialWindow.start)}, {formatIstTime(tt.partialWindow.start)}–{formatIstTime(tt.partialWindow.end)}.
      </div>
    </section>
  );
}
