# Round 2 evidence package

- [PS2_COVERAGE.md](PS2_COVERAGE.md): requirement matrix against the official PS2 and Track 1 wording
- [FINAL_TEST_RESULTS.md](FINAL_TEST_RESULTS.md): tests run on 23 Oct 2026, with pass, fail and skip counts
- [img/](img/): screenshots from the real presentation server with the model on
- [evidence/](evidence/): the recorded model answer, live routing results, access-check results and the walkthrough log
- [../report/](../report/): the detailed PDF report, written against commit `34c743a`

## Changes since Round 1

- **Navigation in presentation mode.** Pressing P hides the sidebar. The top bar now shows compact
  Home · Decisions · Activity · Security links. A regression test was added in `e2e/demo.spec.ts`.
- **Documentation.**
  - Tool and intent counts are corrected: 7 read-only tools, 7 intents (6 answerable plus `unsupported`).
  - The synthetic timetable is now listed as implemented.
  - PS2 coverage is stated honestly.

## Start-up (offline-capable)

1. Run `ollama list`. It should show `llama3.2:1b`. Inference runs locally on 127.0.0.1, so no internet is needed.
2. Run `npm run demo`, or `npm run start` if the app is already built. Then open <http://localhost:3000>.
3. Click **Open Maya's sample workspace**.
4. Open **Decisions → Controlled demo → Reset demo**.
5. Wait for the badge **Local AI · llama3.2:1b (1.2B)**.

## Demo click path

1. Open `/overview?intro=1` and let the intro play, or press Esc. Press **P** for presentation mode.
2. Click **Decisions** in the top bar. Under **Ask your local agent**, click "Which classes clash with the hackathon, and what should I do?"
3. Open **How CampusPilot answered**. It shows the model, the tools the model requested, and the time taken.
4. Click **View timetable**. The highlighted class is the clash for selected sessions.
5. Click **Compare my options**. The options show 74.2 / 77.4 / 80.6%, and the recommendation is conditional against the sample 75% rule.
6. Click **Approve plan**. The tasks are saved on the server.
7. Click **Move deadline to Oct 28, 7:00 PM**. This is a simulated source update. It produces revision 2, moves the work block from Oct 28 to Oct 27, invalidates the approval, and asks for re-approval.
8. Open **Activity** in the top bar and show the "Asked:" run: mode Local LLM, with each tool's requester labelled.
9. Open **Security** and click **Run access check**. Own record returns 200; other students' records return 403.
10. Afterwards: **Decisions → Reset demo**.
