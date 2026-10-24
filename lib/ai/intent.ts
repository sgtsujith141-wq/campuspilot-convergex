import { z } from "zod";

// What the local model is asked to decide, and how its answer is validated.

export const INTENTS = ["attendance_risk", "deadline_conflicts", "class_clashes", "verification", "participation_tradeoffs", "explain_recommendation", "unsupported"] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABEL: Record<Intent, string> = {
  attendance_risk: "Attendance risk",
  deadline_conflicts: "Deadline conflicts",
  class_clashes: "Class clashes",
  verification: "What still needs verification",
  participation_tradeoffs: "Participation trade-offs",
  explain_recommendation: "Why the recommendation",
  unsupported: "Outside what CampusPilot can answer",
};

/**
 * Read-only tools the local model may select. Evaluator/planner tools run on the server, and
 * execution tools are not registered for any agent at all.
 */
export const AI_TOOLS = {
  get_my_attendance: "attendance counts (for attendance questions)",
  get_my_courses: "courses and classes still scheduled (for attendance questions)",
  get_applicable_policy: "minimum attendance rule (for attendance or rules questions)",
  get_my_commitments: "assignment and exam dates (for deadline questions)",
  get_my_timetable: "class timetable: lectures and labs with times (for class or lecture clash questions)",
  get_event: "hackathon dates and registration deadline (for clash or registration questions)",
  verify_event_rules: "official eligibility rules (for eligibility, permission or verification questions)",
} as const;
export type AiTool = keyof typeof AI_TOOLS;
export const AI_TOOL_NAMES = Object.keys(AI_TOOLS) as AiTool[];

/** Evidence the deterministic answer needs for each intent; the server adds any the model omitted. */
export const REQUIRED_TOOLS: Record<Intent, AiTool[]> = {
  attendance_risk: ["get_my_courses", "get_my_attendance", "get_applicable_policy"],
  deadline_conflicts: ["get_my_commitments", "get_event"],
  class_clashes: ["get_my_timetable", "get_event"],
  verification: ["get_event", "verify_event_rules", "get_applicable_policy"],
  participation_tradeoffs: ["get_my_courses", "get_my_attendance", "get_applicable_policy", "get_my_commitments", "get_event"],
  explain_recommendation: ["get_my_courses", "get_my_attendance", "get_applicable_policy", "get_my_commitments", "get_event", "verify_event_rules"],
  unsupported: [],
};

/** JSON schema passed to Ollama's structured-output mode: the reply can only name known intents/tools. */
export const ROUTING_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: INTENTS },
    tools: { type: "array", items: { type: "string", enum: AI_TOOL_NAMES }, maxItems: AI_TOOL_NAMES.length },
  },
  required: ["intent", "tools"],
} as const;

/** Prompt measured against llama3.2:1b on the presentation Mac (kept short: CPU prompt evaluation). */
export const ROUTING_PROMPT =
  "Route a student's question about attending a hackathon. Choose one intent and only the tools needed. JSON only.\n" +
  "Intents: attendance_risk, deadline_conflicts (assignments/exams clashing with the event), class_clashes (classes, lectures or labs clashing with the event), verification (eligibility, permission, OD approval, registration), " +
  "participation_tradeoffs (full vs part vs skip), explain_recommendation, unsupported (unrelated topics or other students).\n" +
  "Tools:\n" +
  AI_TOOL_NAMES.map((t) => `- ${t}: ${AI_TOOLS[t]}`).join("\n");

/** Strict: unknown intents, unknown tools or any extra field (e.g. smuggled arguments) are rejected. */
const RoutingSchema = z
  .object({
    intent: z.enum(INTENTS),
    tools: z.array(z.string()).max(12),
  })
  .strict();

export type Routing = { intent: Intent; tools: string[] };

export function parseRouting(content: string): { ok: true; value: Routing } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return { ok: false, reason: "not valid JSON" };
  }
  const parsed = RoutingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "did not match the routing schema" };
  return { ok: true, value: { intent: parsed.data.intent, tools: Array.from(new Set(parsed.data.tools)) } };
}

// ── Server-side checks that do not depend on the model ───────────────────────

export const MAX_QUESTION_CHARS = 300;

const DOMAIN = /\b(attend\w*|absen\w*|class(es)?|lectures?|labs?|percent\w*|minimum|threshold|deadlines?|due|assignments?|projects?|exams?|assessments?|quiz\w*|tests?|clash\w*|conflict\w*|overlap\w*|hackathon|event|cyberforge|sprint|regist\w*|eligib\w*|allowed|permission|approv\w*|od|on-duty|verify|verification|rules?|polic\w*|participat\w*|join\w*|skip\w*|defer\w*|full|partial|sessions?|recommend\w*|plan|risk\w*|miss\w*|go|whole)\b/i;

/** Deterministic scope gate: off-topic questions are refused without calling the model. */
export function scopeCheck(question: string): { ok: true } | { ok: false; reason: string } {
  const q = question.trim();
  if (q.length < 3) return { ok: false, reason: "Ask a question about attending the event." };
  if (q.length > MAX_QUESTION_CHARS) return { ok: false, reason: `Keep questions under ${MAX_QUESTION_CHARS} characters.` };
  if (!DOMAIN.test(q)) {
    return { ok: false, reason: "CampusPilot can answer questions about your attendance, deadlines, eligibility and participating in this event — not general questions." };
  }
  return { ok: true };
}

/** Flags requests that mention other students. Not a security control — the gateway is. */
export function mentionsOtherStudent(question: string) {
  return /\bstu_[a-z0-9_]+\b|another student|other student|someone else|my friend|classmate|everyone'?s/i.test(question);
}

/**
 * Keyword routing used ONLY when the local model is unavailable or keeps returning invalid
 * output. Runs are labelled deterministic so they are never mistaken for model output.
 */
export function fallbackRoute(question: string): Intent {
  const q = question.toLowerCase();
  if (/(verify|eligib|allowed|permission|approv|\bod\b|on-duty|regist|rules?)/.test(q)) return "verification";
  if (/(timetable|schedule)/.test(q) || (/(class|lecture|lab)/.test(q) && /(clash|conflict|overlap|miss)/.test(q))) return "class_clashes";
  if (/(deadline|due|assignment|project|exam|assessment|quiz|clash|conflict|overlap)/.test(q)) return "deadline_conflicts";
  if (/(recommend|why)/.test(q)) return "explain_recommendation";
  if (/(full|partial|part of|whole|skip|defer|sessions?)/.test(q)) return "participation_tradeoffs";
  if (/(attend|absen|class|lecture|percent|minimum|threshold|miss|risk)/.test(q)) return "attendance_risk";
  return "unsupported";
}
