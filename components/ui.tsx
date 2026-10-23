"use client";

import { useEffect, useId, useRef } from "react";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { Tone } from "@/lib/present";

/** Join class names, dropping empty values (keeps SSR and client markup identical). */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Product mark: a planned route ending at a destination. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect width="22" height="22" rx="6" fill="#142d35" />
      <path d="M5.5 15.5 9.5 11.5 12 14 16 8" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.25" cy="7.75" r="1.75" fill="#4fb3ab" />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <BrandMark />
      <span>CampusPilot</span>
    </div>
  );
}

export function Badge({ tone = "neutral", children, plain = false }: { tone?: Tone; children: React.ReactNode; plain?: boolean }) {
  return <span className={cx("badge", tone !== "neutral" && `badge-${tone}`, plain && "plain")}>{children}</span>;
}

const ALERT_ICON = { info: Info, ok: CircleCheck, warn: TriangleAlert, bad: CircleAlert } as const;

export function Alert({ tone = "info", children, role, dynamic }: { tone?: keyof typeof ALERT_ICON; children: React.ReactNode; role?: "alert" | "status"; dynamic?: boolean }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={`alert alert-${tone}`} role={role} data-dynamic={dynamic || undefined}>
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Meter({ value, threshold, tone, label }: { value: number | null; threshold?: number | null; tone?: "warn" | "bad"; label: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(pct * 10) / 10} aria-label={label}>
      <div className={cx("fill", tone)} style={{ width: `${pct}%` }} />
      {threshold != null && <span className="tick" style={{ left: `calc(${threshold}% - 1px)` }} title={`Sample threshold ${threshold}%`} />}
    </div>
  );
}

export function Spinner({ size = 15 }: { size?: number }) {
  return <LoaderCircle size={size} className="spin" aria-hidden="true" />;
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/**
 * Modal dialog: focus moves inside on open, Tab is trapped, Escape closes, focus returns to the
 * element that opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('button, [href], select, input, [tabindex]:not([tabindex="-1"])') ?? []).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} ref={ref}>
        <div className="dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descId}>{description}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-foot">
          {footer ?? (
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
