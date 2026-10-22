# 07 — Verified event details, source references, competitor boundaries

Research captured October 22, 2026. Verify organizer communications, registration status, and any later rule changes before attending. Each URL is a source to inspect; this file is not proof of a completed submission.

## ConvergeX official facts

Official event listing: https://vit.ac.in/event/convergex
Official brochure (one page): https://vit.ac.in/wp-content/uploads/2026/09/AI-Solution-Sprint-2026.pdf

The brochure identifies event date Friday October 23, 2026, location VIT Vellore, event window 9:30 AM–5:00 PM, eligibility UG/PG/research scholars in teams 2–4, registration fee ₹350 per person, last registration October 15, 2026, PS2 AI-Based Smart Campus Management. It also lists five solution tracks; Track 1 AI Agents has reasoning, planning, tool usage, task execution. PS2 asks for intelligent campus management including resource optimization, security, energy management and student services. It presents a 3–4-week development period for selected teams and describes prototype demonstration to industry and academic experts. The showcase review sessions are 10:15 AM–1:00 PM and 2:00–4:00 PM; other schedule segments include intro, briefing, lunch, feedback, closing.

No publicly specified mandatory PowerPoint template, slide count, submission URL for prototype, code requirements, detailed rubric or scoring percentages were found on the brochure. Do not assume those are definitively absent from private organizer messages. Confirm onsite.

**Zero Shot collision:** https://events.vit.ac.in/Users/publicEvent/001179 reports Zero Shot Hack Friday Oct 23, 9 AM–5 PM, simultaneously with ConvergeX. Full same-day overlapping schedule. If the user is registered for both, this is a serious participation clash.

## Regulations: importance of caveats

VIT SCOPE proctor guidance: https://scopecc.vit.ac.in/pages/proctors.html
It advises physical attendance minimum 75% **except eligible CGPA 9.0 or above students**, and advises advance approval of On-Duty requests for external participation. It also cautions not to assure academic relief without verifying relevant regulations. These are public guidance highlights, not sufficient to determine any individual student's eligibility.

VIT academic regulations PDF: https://vit.ac.in/sites/default/files/academic/Academic-Regulations.pdf (published Version 4.0; applicability depends on student/program). For prototype, explicitly configured 75% rule is fictional/simplified and all claims should say example policy.

## Relevant competitor facts

- **AssignoFast** by IEEE-CS VIT: https://assignofast.ieeecsvit.com/ — deadlines, assignment and timetable sync, notifications, personal tasks. Its site says assignment sync occurs after VTOP login; conventional deadline aggregation is not new.
- **VtopMCP** by Vikranth Jagdish: https://github.com/Vikranth-jagdish/VtopMCP — unofficial MCP server exposing VTOP attendance, exam schedules, timetable and more. README explicitly warns it is tested for **VIT Chennai only**, not VIT Vellore; no inference of supported institutional API or approved credentials. Do not integrate without separate authorization.
- **The College Agent:** https://thecollegeagent.ai/ — advertises an AI personal operating system with connected calendars, deadlines, tasks, proactive actions and various app integrations. A personal student AI is not unprecedented.
- **VITian:** official app exists; availability of timetable, attendance, examination dates and assignments has been documented in prior competitive research. Confirm relevant features directly if making detailed live claims.
- **OR-Tools scheduling:** https://developers.google.com/optimization/ — mature scheduling and constraints library, useful only if the problem grows beyond simple option enumeration. No need to claim invented optimization algorithms.

## Agent engineering / security source material

- **OWASP AI Agent Security Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html — least privilege, separate decision/execution, human approval, schema validation, isolation, logging, red-teaming.
- **OWASP Agentic AI Threats & Mitigations:** https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ — tool misuse, identity, hijacking and other agentic security threats.
- **OWASP prompt injection glossary:** https://genai.owasp.org/glossaries/prompt-injection/ — prompt defenses alone cannot guarantee a boundary; design permissions outside LLM.
- **LangGraph interrupt/reference:** https://reference.langchain.com/python/langgraph/types/interrupt and https://github.com/langchain-ai/langgraphjs/blob/main/docs/docs/concepts/human_in_the_loop.md — resumable human approval pattern with checkpointing, conditional on framework choice.

## Positioning conclusion

Do not pitch "first AI student agent," "first VTOP AI connector," or "AI attendance calculator." Describe a testable **cross-source decision and secure replanning** product. Evidence of actual adoption, missed-deadline reduction, model accuracy and VIT endorsement is nonexistent at preparation time and must not be fabricated.
