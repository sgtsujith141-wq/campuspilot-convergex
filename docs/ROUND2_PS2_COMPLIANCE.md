# Round 2: PS2 compliance statement

CampusPilot is a **PS2 (AI-Based Smart Campus Management), Track 1 (AI Agents)** submission. The
official PS2 wording lists "areas *such as* resource optimization, security, energy management and
student services".

| Area | Status in this prototype |
|---|---|
| Student services | **Implemented for one scenario.** An event-participation decision, end to end. |
| Security | **Limited.** Covers the application's academic data and the actions it can take. Physical campus security is not covered. |
| Resource optimization | **Limited.** Covers one student's time and attendance. Rooms, labs and staff are not covered. |
| Energy management | **Not implemented.** |

| Track 1 capability | Status |
|---|---|
| Reasoning | **Hybrid.** The model interprets the question; deterministic rules evaluate the constraints. |
| Planning | **Implemented** for one mission type, including replanning when a source changes. |
| Tool usage | **Implemented.** Scoped, read-only tools selected by the model, with server-required evidence added. |
| Task execution | **Limited.** Tasks are saved locally after approval. Nothing is done in external systems. |

**What we do not claim:**

- that all four example areas are mandatory
- that the areas we leave out don't matter to the judges
- official compliance (no rubric was published)
- real student data, VTOP integration, or measured impact

**Further detail:**

- Full matrix with evidence: [round2/PS2_COVERAGE.md](round2/PS2_COVERAGE.md)
- Test results: [round2/FINAL_TEST_RESULTS.md](round2/FINAL_TEST_RESULTS.md)
- Detailed report, written against commit `34c743a`: [report/CampusPilot_PS2_Implementation_Compliance_Report.pdf](report/CampusPilot_PS2_Implementation_Compliance_Report.pdf)
