import { Asterisk } from "lucide-react";

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <Asterisk size={22} strokeWidth={2.4} />
      </div>
      <span>
        campus<span className="brand-strong">pilot</span>
      </span>
    </div>
  );
}
