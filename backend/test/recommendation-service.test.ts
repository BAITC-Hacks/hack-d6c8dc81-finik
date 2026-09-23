import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { ActiveDataset, ActivityHistoryRecord, Employee, Event } from "../src/domain/types.js";
import { buildActiveDataset, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import { reconstructCurrentSkills, resolveTargetProfile } from "../src/services/profile-service.js";
import {
  calculateRecommendationScore,
  evaluateRecommendationCandidate,
  getEmployeeRecommendations,
} from "../src/services/recommendation-service.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");
let baseDataset: ActiveDataset;

function eventFixture(overrides: Partial<Event>): Event {
  return {
    event_id: "EV_REC",
    title: "Recommendation fixture",
    description: "Controlled recommendation fixture.",
    type: "workshop",
    format: "self_paced",
    duration_hours: 4,
    mandatory: false,
    target_roles: ["Backend Engineer"],
    target_grades: ["Junior"],
    develops_skills: [{ skill_id: "SK_SQL", gain: 1, max_level: 5 }],
    prerequisites: {},
    upcoming_sessions: [],
    ...overrides,
  };
}

function historyFixture(overrides: Partial<ActivityHistoryRecord>): ActivityHistoryRecord {
  return {
    record_id: "R_REC",
    employee_id: "E0001",
    event_id: "EV_REC",
    date: "2026-09-20",
    due_date: null,
    status: "completed",
    completion_pct: 100,
    score: null,
    feedback_rating: null,
    assigned_by: "self",
    ...overrides,
  };
}

function fixtureDataset({
  employeeOverrides = {},
  additionalEvents = [],
  history = [],
}: {
  employeeOverrides?: Partial<Employee>;
  additionalEvents?: Event[];
  history?: ActivityHistoryRecord[];
} = {}): ActiveDataset {
  const sourceEmployee = baseDataset.indexes.employeesById.get("E0001");
  if (!sourceEmployee) throw new Error("Expected E0001 in starter data.");
  const employee: Employee = {
    ...sourceEmployee,
    ...employeeOverrides,
    skills: { ...sourceEmployee.skills, ...employeeOverrides.skills },
  };

  return buildActiveDataset({
    ...baseDataset.dataset,
    employees: baseDataset.dataset.employees.map((item) => item.employee_id === employee.employee_id ? employee : item),
    events: [...baseDataset.dataset.events, ...additionalEvents],
    activityHistory: [
      ...baseDataset.dataset.activityHistory.filter((record) => record.employee_id !== employee.employee_id),
      ...history,
    ],
  });
}

function candidateFor(activeDataset: ActiveDataset, event: Event) {
  const employee = activeDataset.indexes.employeesById.get("E0001");
  if (!employee) throw new Error("Expected E0001 fixture employee.");
  return evaluateRecommendationCandidate(
    activeDataset,
    employee,
    resolveTargetProfile(activeDataset, employee),
    reconstructCurrentSkills(activeDataset, employee),
    event,
  );
}

describe("recommendation engine", () => {
  beforeAll(async () => {
    baseDataset = await loadDatasetFromDirectory(dataDirectory);
  });

  it("keeps a real target-gap improvement eligible and excludes satisfied, mandatory, and unmet-prerequisite events", () => {
    const activeDataset = fixtureDataset();
    const relevant = eventFixture({ event_id: "EV_REC_RELEVANT" });
    const satisfied = eventFixture({ event_id: "EV_REC_SATISFIED", develops_skills: [{ skill_id: "SK_PYTHON", gain: 1, max_level: 5 }] });
    const mandatory = eventFixture({ event_id: "EV_REC_MANDATORY", mandatory: true });
    const blocked = eventFixture({ event_id: "EV_REC_BLOCKED", prerequisites: { SK_SYSTEM_DESIGN: 5 } });

    expect(candidateFor(activeDataset, relevant)).not.toBeNull();
    expect(candidateFor(activeDataset, satisfied)).toBeNull();
    expect(candidateFor(activeDataset, mandatory)).toBeNull();
    expect(candidateFor(activeDataset, blocked)).toBeNull();
  });

  it("handles scheduled availability, self-paced availability, and the temporary completion policy", () => {
    const completed = eventFixture({
      event_id: "EV_REC_COMPLETED",
      develops_skills: [{ skill_id: "SK_PYTHON", gain: 1, max_level: 5 }],
    });
    const activeDataset = fixtureDataset({
      additionalEvents: [completed],
      history: [historyFixture({ event_id: "EV_REC_COMPLETED" })],
    });
    const unavailableScheduled = eventFixture({ event_id: "EV_REC_UNAVAILABLE", format: "online", upcoming_sessions: [] });
    const selfPaced = eventFixture({ event_id: "EV_REC_SELF_PACED" });

    expect(candidateFor(activeDataset, unavailableScheduled)).toBeNull();
    expect(candidateFor(activeDataset, selfPaced)).toMatchObject({ nextSession: null });
    expect(candidateFor(activeDataset, completed)).toBeNull();
  });

  it("prioritizes useful critical progress without letting criticality replace useful gain", () => {
    const activeDataset = fixtureDataset({ employeeOverrides: { skills: { SK_PYTHON: 2, SK_SQL: 2 } } });
    const critical = candidateFor(activeDataset, eventFixture({
      event_id: "EV_REC_CRITICAL",
      develops_skills: [{ skill_id: "SK_PYTHON", gain: 1, max_level: 5 }],
    }));
    const nonCritical = candidateFor(activeDataset, eventFixture({
      event_id: "EV_REC_NON_CRITICAL",
      develops_skills: [{ skill_id: "SK_SQL", gain: 1, max_level: 5 }],
    }));
    const largerNonCritical = candidateFor(activeDataset, eventFixture({
      event_id: "EV_REC_LARGER",
      develops_skills: [
        { skill_id: "SK_SQL", gain: 1, max_level: 5 },
        { skill_id: "SK_SYSTEM_DESIGN", gain: 1, max_level: 5 },
      ],
    }));

    expect(critical?.score).toBeGreaterThan(nonCritical?.score ?? 0);
    expect(largerNonCritical?.score).toBeGreaterThan(critical?.score ?? 0);
  });

  it("returns multi-skill factors and caps expected/effective progress correctly", () => {
    const activeDataset = fixtureDataset({ employeeOverrides: { skills: { SK_SQL: 2, SK_SYSTEM_DESIGN: 1 } } });
    const multiSkill = candidateFor(activeDataset, eventFixture({
      event_id: "EV_REC_MULTI",
      develops_skills: [
        { skill_id: "SK_SQL", gain: 1, max_level: 5 },
        { skill_id: "SK_SYSTEM_DESIGN", gain: 1, max_level: 5 },
      ],
    }));
    const eventCapped = candidateFor(activeDataset, eventFixture({
      event_id: "EV_REC_EVENT_CAP",
      develops_skills: [{ skill_id: "SK_SQL", gain: 3, max_level: 3 }],
    }));
    const gapCapped = candidateFor(activeDataset, eventFixture({
      event_id: "EV_REC_GAP_CAP",
      develops_skills: [{ skill_id: "SK_SYSTEM_DESIGN", gain: 3, max_level: 5 }],
    }));

    expect(multiSkill?.factors.skill_impacts).toHaveLength(2);
    expect(eventCapped?.factors.skill_impacts[0]).toMatchObject({ current_level: 2, expected_level: 3, max_level: 3 });
    expect(eventCapped?.score).toBe(10);
    expect(gapCapped?.factors.skill_impacts[0]).toMatchObject({ current_level: 1, required_level: 2, expected_level: 4 });
    expect(gapCapped?.score).toBe(10);
  });

  it("reports similar completed and missed participation factors", () => {
    const candidate = eventFixture({ event_id: "EV_REC_CANDIDATE", develops_skills: [{ skill_id: "SK_SQL", gain: 1, max_level: 5 }] });
    const similar = eventFixture({ event_id: "EV_REC_SIMILAR", develops_skills: [{ skill_id: "SK_SQL", gain: 1, max_level: 5 }] });
    const activeDataset = fixtureDataset({
      additionalEvents: [similar],
      history: [
        historyFixture({ record_id: "R_REC_COMPLETED", event_id: "EV_REC_SIMILAR", date: "2026-08-20", status: "completed", completion_pct: 100 }),
        historyFixture({ record_id: "R_REC_NO_SHOW", event_id: "EV_REC_SIMILAR", date: "2026-08-21", status: "no_show", completion_pct: 0 }),
        historyFixture({ record_id: "R_REC_DECLINED", event_id: "EV_REC_SIMILAR", date: "2026-08-22", status: "declined", completion_pct: 0 }),
        historyFixture({ record_id: "R_REC_DROPPED", event_id: "EV_REC_SIMILAR", date: "2026-08-23", status: "dropped", completion_pct: 50 }),
      ],
    });

    expect(candidateFor(activeDataset, candidate)?.factors).toMatchObject({
      completed_similar: 1,
      missed_or_declined_similar: 3,
    });
  });

  it("lets participation change close ranking but not erase strong critical multi-skill progress", () => {
    const ordinary = eventFixture({ event_id: "EV_REC_ORDINARY", develops_skills: [{ skill_id: "SK_SQL", gain: 1, max_level: 5 }] });
    const strong = eventFixture({
      event_id: "EV_REC_STRONG",
      develops_skills: [
        { skill_id: "SK_PYTHON", gain: 1, max_level: 5 },
        { skill_id: "SK_API_DESIGN", gain: 1, max_level: 5 },
      ],
    });
    const similarStrong = eventFixture({
      event_id: "EV_REC_SIMILAR_STRONG",
      develops_skills: [{ skill_id: "SK_PYTHON", gain: 1, max_level: 5 }],
    });
    const activeDataset = fixtureDataset({
      employeeOverrides: { skills: { SK_PYTHON: 2, SK_API_DESIGN: 2, SK_SQL: 2 } },
      additionalEvents: [ordinary, strong, similarStrong],
      history: [
        historyFixture({ record_id: "R_REC_MISS_1", event_id: "EV_REC_SIMILAR_STRONG", status: "no_show", completion_pct: 0 }),
        historyFixture({ record_id: "R_REC_MISS_2", event_id: "EV_REC_SIMILAR_STRONG", status: "declined", completion_pct: 0 }),
        historyFixture({ record_id: "R_REC_MISS_3", event_id: "EV_REC_SIMILAR_STRONG", status: "dropped", completion_pct: 20 }),
      ],
    });

    const strongCandidate = candidateFor(activeDataset, strong);
    const ordinaryCandidate = candidateFor(activeDataset, ordinary);

    expect(strongCandidate?.score).toBe(25);
    expect(strongCandidate?.score).toBeGreaterThan(ordinaryCandidate?.score ?? 0);
  });

  it("uses stable session, duration, and ID tie-breakers and returns no more than three results", () => {
    const target = baseDataset.indexes.roleProfilesByKey.get("Backend Engineer\u0000Middle");
    if (!target) throw new Error("Expected Backend Engineer/Middle target profile.");
    const events = [
      eventFixture({ event_id: "EV_REC_A", format: "online", duration_hours: 8, upcoming_sessions: ["2026-10-20"] }),
      eventFixture({ event_id: "EV_REC_B", format: "online", duration_hours: 8, upcoming_sessions: ["2026-10-10"] }),
      eventFixture({ event_id: "EV_REC_C", format: "online", duration_hours: 3, upcoming_sessions: ["2026-10-10"] }),
      eventFixture({ event_id: "EV_REC_D", format: "online", duration_hours: 3, upcoming_sessions: ["2026-10-10"] }),
    ];
    const recommendations = getEmployeeRecommendations(fixtureDataset({
      employeeOverrides: { skills: { ...target.required_skills, SK_SQL: 2 } },
      additionalEvents: events,
    }), "E0001").recommendations;

    expect(recommendations.map((recommendation) => recommendation.event_id)).toEqual(["EV_REC_C", "EV_REC_D", "EV_REC_B"]);
    expect(recommendations).toHaveLength(3);
  });

  it("returns zero recommendations when all target requirements are already satisfied", () => {
    const target = baseDataset.indexes.roleProfilesByKey.get("Backend Engineer\u0000Middle");
    if (!target) throw new Error("Expected Backend Engineer/Middle target profile.");
    const activeDataset = fixtureDataset({ employeeOverrides: { skills: target.required_skills } });

    expect(getEmployeeRecommendations(activeDataset, "E0001").recommendations).toEqual([]);
  });

  it("keeps factors, score, explanation, career goals, and unknown employee errors consistent", () => {
    const activeDataset = fixtureDataset();
    const candidate = candidateFor(activeDataset, eventFixture({ event_id: "EV_REC_FACTORS" }));
    if (!candidate) throw new Error("Expected recommendation candidate.");
    const impact = candidate.factors.skill_impacts[0];
    const effectiveGain = Math.min(
      impact.required_level - impact.current_level,
      impact.expected_level - impact.current_level,
    );

    expect(candidate.score).toBe(calculateRecommendationScore({
      effectiveGain,
      criticalEffectiveGain: impact.critical ? effectiveGain : 0,
      usefulSkillCount: candidate.factors.skill_impacts.length,
      completedSimilar: candidate.factors.completed_similar,
      missedOrDeclinedSimilar: candidate.factors.missed_or_declined_similar,
    }));
    const response = getEmployeeRecommendations(activeDataset, "E0001");
    expect(response.recommendations.every((recommendation) => !recommendation.explanation.includes("critical requirement") || recommendation.factors.skill_impacts.some((impact) => impact.critical))).toBe(true);
    expect(getEmployeeRecommendations(baseDataset, "E0004")).toMatchObject({ target_role: "Product Manager", target_grade: "Middle" });
    expect(() => getEmployeeRecommendations(activeDataset, "E_UNKNOWN")).toThrow("Employee E_UNKNOWN was not found.");
  });
});
