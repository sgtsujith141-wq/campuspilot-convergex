import type { DatabaseSync } from "node:sqlite";
import { assessmentSeed, assignmentSeed, scenario } from "@/lib/scenario";

export const MAYA_ID = scenario.student.id; // stu_maya_demo
export const OTHER_ID = scenario.securityExample.targetStudent; // stu_other_demo
/** Fixed IDs of the second fictional profile's records, used only by isolation tests/probes. */
export const OTHER_FIXTURE = {
  studentId: OTHER_ID,
  courseId: "oth_course_ns",
  missionId: "msn_other_demo",
} as const;

type SourceSeed = {
  id: string;
  ownerId: string | null;
  kind: string;
  recordType: "course" | "assignment" | "assessment" | "opportunity" | "policy" | "timetable";
  label: string;
  payload: unknown;
};

/** Synthetic weekly timetable (sample records, not VTOP). Its sessions explain the seed's
 *  futureScheduled and missesByOption counts; a unit test checks that they agree. */
export const MAYA_TIMETABLE = {
  plannedPartialWindow: { start: "2026-10-29T10:00:00+05:30", end: "2026-10-29T13:00:00+05:30", note: "Guided selected-session assumption" },
  sessions: [
    { id: "cls_ns_1026", courseId: "course_ns", code: "CS201", name: "Network Security", type: "Lecture", start: "2026-10-26T11:00:00+05:30", end: "2026-10-26T12:00:00+05:30", room: "SJT 402", instructor: "Dr. A. Menon" },
    { id: "cls_db_1026", courseId: "course_db", code: "CS203", name: "Database Systems", type: "Lab", start: "2026-10-26T14:00:00+05:30", end: "2026-10-26T15:00:00+05:30", room: "TT Lab 3", instructor: "Prof. R. Iyer" },
    { id: "cls_dm_1027", courseId: "course_dm", code: "MA202", name: "Discrete Mathematics", type: "Lecture", start: "2026-10-27T09:00:00+05:30", end: "2026-10-27T10:00:00+05:30", room: "MB 214", instructor: "Dr. S. Kapoor" },
    { id: "cls_dm_1028", courseId: "course_dm", code: "MA202", name: "Discrete Mathematics", type: "Lecture", start: "2026-10-28T09:00:00+05:30", end: "2026-10-28T10:00:00+05:30", room: "MB 214", instructor: "Dr. S. Kapoor" },
    { id: "cls_ns_1028", courseId: "course_ns", code: "CS201", name: "Network Security", type: "Lecture", start: "2026-10-28T11:00:00+05:30", end: "2026-10-28T12:00:00+05:30", room: "SJT 402", instructor: "Dr. A. Menon" },
    { id: "cls_db_1028", courseId: "course_db", code: "CS203", name: "Database Systems", type: "Lecture", start: "2026-10-28T14:00:00+05:30", end: "2026-10-28T15:00:00+05:30", room: "SJT 310", instructor: "Prof. R. Iyer" },
    { id: "cls_ns_1029", courseId: "course_ns", code: "CS201", name: "Network Security", type: "Lecture", start: "2026-10-29T11:00:00+05:30", end: "2026-10-29T12:00:00+05:30", room: "SJT 402", instructor: "Dr. A. Menon" },
    { id: "cls_db_1029", courseId: "course_db", code: "CS203", name: "Database Systems", type: "Lab", start: "2026-10-29T14:00:00+05:30", end: "2026-10-29T15:00:00+05:30", room: "TT Lab 3", instructor: "Prof. R. Iyer" },
    { id: "cls_ns_1030", courseId: "course_ns", code: "CS201", name: "Network Security", type: "Lab", start: "2026-10-30T11:00:00+05:30", end: "2026-10-30T12:00:00+05:30", room: "TT Lab 1", instructor: "Dr. A. Menon" },
  ],
};

function studentSources(studentId: string): SourceSeed[] {
  if (studentId === MAYA_ID) {
    const a = assignmentSeed();
    const s = assessmentSeed();
    return [
      ...scenario.courses.map((c) => ({
        id: c.id,
        ownerId: MAYA_ID,
        kind: "academic_simulator",
        recordType: "course" as const,
        label: `${c.code} ${c.name} attendance`,
        payload: c,
      })),
      {
        id: a.id,
        ownerId: MAYA_ID,
        kind: "academic_simulator",
        recordType: "assignment",
        label: `${a.name} record`,
        payload: { id: a.id, courseId: a.courseId, name: a.name, dueAt: a.dueAt },
      },
      {
        id: s.id,
        ownerId: MAYA_ID,
        kind: "academic_simulator",
        recordType: "assessment",
        label: `${s.name} record`,
        payload: { id: s.id, courseId: s.courseId, name: s.name, startsAt: s.startsAt, studyHoursDesired: s.studyHoursDesired },
      },
      { id: "timetable_maya", ownerId: MAYA_ID, kind: "academic_simulator", recordType: "timetable", label: "Synthetic class timetable (Oct 26–30)", payload: MAYA_TIMETABLE },
    ];
  }
  if (studentId === OTHER_ID) {
    // Second fictional profile: exists only so cross-student isolation can be tested.
    const course = (id: string, code: string, name: string, attended: number, total: number) => ({
      id,
      ownerId: OTHER_ID,
      kind: "academic_simulator",
      recordType: "course" as const,
      label: `${code} ${name} attendance`,
      payload: { id, code, name, attended, total, futureScheduled: 3, missesByOption: { full: 2, partial: 1, defer: 0 } },
    });
    return [
      course(OTHER_FIXTURE.courseId, "CS201", "Network Security", 26, 28),
      course("oth_course_os", "CS205", "Operating Systems", 30, 33),
      {
        id: "oth_assignment_os",
        ownerId: OTHER_ID,
        kind: "academic_simulator",
        recordType: "assignment",
        label: "OS lab report record",
        payload: { id: "oth_assignment_os", courseId: "oth_course_os", name: "OS lab report", dueAt: "2026-11-02T18:00:00+05:30" },
      },
      {
        id: "oth_assessment_ns",
        ownerId: OTHER_ID,
        kind: "academic_simulator",
        recordType: "assessment",
        label: "Network Security quiz record",
        payload: { id: "oth_assessment_ns", courseId: OTHER_FIXTURE.courseId, name: "Network Security quiz", startsAt: "2026-11-03T09:00:00+05:30", studyHoursDesired: 2 },
      },
    ];
  }
  return [];
}

function sharedSources(): SourceSeed[] {
  const o = scenario.opportunity;
  return [
    {
      id: o.id,
      ownerId: null,
      kind: "curated_example",
      recordType: "opportunity",
      label: `${o.name} listing`,
      payload: {
        ...o,
        description: "Fictional two-day cybersecurity sprint created for the CampusPilot controlled demo.",
      },
    },
    {
      id: scenario.policy.id,
      ownerId: null,
      kind: "sample_policy",
      recordType: "policy",
      label: "Sample attendance policy",
      payload: scenario.policy,
    },
  ];
}

function insertSource(db: DatabaseSync, s: SourceSeed) {
  db.prepare(
    `INSERT INTO source_records (id, owner_id, kind, record_type, label, verification, version, retrieved_at, payload_json)
     VALUES (?, ?, ?, ?, ?, 'synthetic', 1, ?, ?)`,
  ).run(s.id, s.ownerId, s.kind, s.recordType, s.label, scenario.dataAsOf, JSON.stringify(s.payload));
  db.prepare(`INSERT INTO source_history (source_id, version, payload_json, changed_at, reason) VALUES (?, 1, ?, ?, 'seed')`).run(
    s.id,
    JSON.stringify(s.payload),
    scenario.dataAsOf,
  );
}

export function seedDatabase(db: DatabaseSync) {
  const insertStudent = db.prepare(
    `INSERT INTO students (id, display_name, fictional, campus, profile_json, login_enabled) VALUES (?, ?, 1, ?, ?, ?)`,
  );
  insertStudent.run(
    MAYA_ID,
    scenario.student.name,
    scenario.student.campus,
    JSON.stringify({ interests: scenario.student.interests, goals: scenario.student.goals }),
    1,
  );
  // login_enabled = 0: the sample-login route can never issue a session for this profile.
  insertStudent.run(OTHER_ID, "Test Student B", "Sample campus environment", JSON.stringify({ interests: [], goals: [] }), 0);
  for (const s of [...sharedSources(), ...studentSources(MAYA_ID), ...studentSources(OTHER_ID)]) insertSource(db, s);
}

/** Additive upgrade for existing databases: insert any seed record that is missing (never overwrites). */
export function seedMissingSources(db: DatabaseSync) {
  for (const s of [...sharedSources(), ...studentSources(MAYA_ID), ...studentSources(OTHER_ID)]) {
    const exists = db.prepare("SELECT 1 FROM source_records WHERE id = ?").get(s.id);
    if (!exists) insertSource(db, s);
  }
}

/** Restore one student's synthetic source records to the seed (demo reset). */
export function restoreStudentSources(db: DatabaseSync, studentId: string) {
  for (const s of studentSources(studentId)) {
    db.prepare("DELETE FROM source_history WHERE source_id = ?").run(s.id);
    db.prepare("DELETE FROM source_records WHERE id = ? AND owner_id = ?").run(s.id, studentId);
    insertSource(db, s);
  }
}
