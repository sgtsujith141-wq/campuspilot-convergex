// Timestamps are stored as ISO 8601 strings with explicit offsets and displayed in Asia/Kolkata.
// IST is a fixed +05:30 offset (no DST), which keeps calendar arithmetic exact.

export const TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;
const HOUR = 3600 * 1000;

export function toMs(iso: string): number {
  if (!/([+-]\d{2}:\d{2}|Z)$/.test(iso)) {
    throw new RangeError(`Timestamp must carry an explicit offset: ${iso}`);
  }
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid timestamp: ${iso}`);
  return ms;
}

/** Calendar parts of an instant as seen in IST. */
export function istParts(ms: number) {
  const d = new Date(ms + IST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

/** Build an ISO string with +05:30 for an IST wall-clock time. */
export function istIso(year: number, month: number, day: number, hour = 0, minute = 0): string {
  const ms = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS;
  return msToIst(ms);
}

export function msToIst(ms: number): string {
  const p = istParts(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00+05:30`;
}

export function addHours(iso: string, hours: number): string {
  return msToIst(toMs(iso) + hours * HOUR);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clock(hour: number, minute: number) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return minute === 0 ? `${h12}:00 ${suffix}` : `${h12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** "Oct 29, 6:00 PM" in IST, independent of the host machine's timezone. */
export function formatIst(iso: string): string {
  const p = istParts(toMs(iso));
  return `${MONTHS[p.month - 1]} ${p.day}, ${clock(p.hour, p.minute)}`;
}

export function formatIstDay(iso: string): { day: string; month: string } {
  const p = istParts(toMs(iso));
  return { day: String(p.day), month: MONTHS[p.month - 1].toUpperCase() };
}

export function formatIstTime(iso: string): string {
  const p = istParts(toMs(iso));
  return clock(p.hour, p.minute);
}

/** "Oct 28, 6–9 PM" for a block within one day. */
export function formatBlock(block: { start: string; end: string }): string {
  const s = istParts(toMs(block.start));
  const e = istParts(toMs(block.end));
  const short = (h: number, m: number) => clock(h, m).replace(":00", "");
  const sameMeridiem = s.hour >= 12 === e.hour >= 12;
  const startLabel = sameMeridiem ? short(s.hour, s.minute).replace(/ (AM|PM)$/, "") : short(s.hour, s.minute);
  return `${MONTHS[s.month - 1]} ${s.day}, ${startLabel}–${short(e.hour, e.minute)}`;
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

/** "5:42:13 AM" in IST — used for real event timestamps (audit, traces, approvals). */
export function formatIstClock(iso: string): string {
  const p = istParts(toMs(iso));
  const d = new Date(toMs(iso) + IST_OFFSET_MS);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h12}:${String(p.minute).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")} ${p.hour < 12 ? "AM" : "PM"}`;
}

/** "23 Oct, 5:42 AM" — real timestamps with a date. */
export function formatIstStamp(iso: string): string {
  const p = istParts(toMs(iso));
  return `${p.day} ${MONTHS[p.month - 1]}, ${clock(p.hour, p.minute)}`;
}

/** "Oct 29" (adds the year when asked). */
export function formatIstDate(iso: string, withYear = false): string {
  const p = istParts(toMs(iso));
  return withYear ? `${MONTHS[p.month - 1]} ${p.day}, ${p.year}` : `${MONTHS[p.month - 1]} ${p.day}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Thu, Oct 22" in IST. */
export function formatIstWeekday(iso: string): string {
  const ms = toMs(iso);
  const p = istParts(ms);
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return `${WEEKDAYS[dow]}, ${MONTHS[p.month - 1]} ${p.day}`;
}

/**
 * Compact date range in IST: "Oct 29", "Oct 29–30", "Oct 30 – Nov 2", "Dec 31, 2026 – Jan 2, 2027".
 * Derived from data so no month or year is ever hard-coded in the UI.
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const a = istParts(toMs(startIso));
  const b = istParts(toMs(endIso));
  if (a.year !== b.year) return `${MONTHS[a.month - 1]} ${a.day}, ${a.year} – ${MONTHS[b.month - 1]} ${b.day}, ${b.year}`;
  if (a.month !== b.month) return `${MONTHS[a.month - 1]} ${a.day} – ${MONTHS[b.month - 1]} ${b.day}`;
  if (a.day !== b.day) return `${MONTHS[a.month - 1]} ${a.day}–${b.day}`;
  return `${MONTHS[a.month - 1]} ${a.day}`;
}

/** Calendar-day key in IST, for grouping timeline entries. */
export function istDayKey(iso: string): string {
  const p = istParts(toMs(iso));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
