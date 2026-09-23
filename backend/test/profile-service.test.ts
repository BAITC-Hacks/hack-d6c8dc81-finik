import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { ActiveDataset, ActivityHistoryRecord, Employee, Event } from "../src/domain/types.js";
import { buildActiveDataset, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import {
  getEmployeeProfile,
  reconstructCurrentSkills,
  resolveTargetProfile,
} from "../src/services/profile-service.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");

let baseDataset: ActiveDataset;

function eventFixture(overrides: Partial<Event>): Event {
  return {
    event_id: "EV_TEST",
    title: "Test activity",
    description: "Controlled test activity.",
    type: "course",
    format: "self_paced",
    duration_hours: 1,
    mandatory: false,
    target_roles: ["Backend Engineer"],
    target_grades: ["Junior"],
    develops_skills: [],
    prerequisites: {},
    upcoming_sessions: [],
    ...overrides,
  };
}

function recordFixture(overrides: Partial<ActivityHistoryRecord>): ActivityHistoryRecord {
  return {
    record_id: "R_TEST",
    employee_id: "E0001",
    event_id: "EV_TEST",
    date: "2026-09-12",
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
  replacementSkills,
  additionalEvents = [],
  history = [],
}: {
  employeeOverrides?: Partial<Employee>;
  replacementSkills?: Record<string, number>;
  additionalEvents?: Event[];
  history?: ActivityHistoryRecord[];
} = {}): ActiveDataset {
  const originalEmployee = baseDataset.indexes.employeesById.get("E0001");
  if (!originalEmployee) {
    throw new Error("Expected E0001 in the starter dataset.");
  }
  const employee: Employee = {
    ...originalEmployee,
    ...employeeOverrides,
    skills: replacementSkills ?? { ...originalEmployee.skills, ...employeeOverrides.skills },
  };

  return buildActiveDataset({
    ...baseDataset.dataset,
    employees: baseDataset.dataset.employees.map((candidate) =>
      candidate.employee_id === employee.employee_id ? employee : candidate,
    ),
    events: [...baseDataset.dataset.events, ...additionalEvents],
    activityHistory: [
      ...baseDataset.dataset.activityHistory.filter((record) => record.employee_id !== employee.employee_id),
      ...history,
    ],
  });
}

describe("employee profile calculations", () => {
  beforeAll(async () => {
    baseDataset = await loadDatasetFromDirectory(dataDirectory);
  });

  it("uses the next known grade for an employee without a career goal", () => {
    const employee = baseDataset.indexes.employeesById.get("E0003");
    if (!employee) throw new Error("Expected E0003 in the starter dataset.");

    const target = resolveTargetProfile(baseDataset, employee);

    expect(employee.career_goal).toBeNull();
    expect(target.role).toBe("Customer Support Specialist");
    expect(target.grade).toBe("Lead");
  });

  it("uses the current profile for a highest-grade employee without a career goal", () => {
    const employee = baseDataset.indexes.employeesById.get("E0006");
    if (!employee) throw new Error("Expected E0006 in the starter dataset.");

    const target = resolveTargetProfile(baseDataset, employee);

    expect(employee.career_goal).toBeNull();
    expect(target.role).toBe("Frontend Engineer");
    expect(target.grade).toBe("Lead");
  });

  it("uses a valid career goal targeting another role", () => {
    const employee = baseDataset.indexes.employeesById.get("E0004");
    if (!employee) throw new Error("Expected E0004 in the starter dataset.");

    const profile = getEmployeeProfile(baseDataset, employee.employee_id);

    expect(profile.target_role).toBe("Product Manager");
    expect(profile.target_grade).toBe("Middle");
  });

  it("treats an unassessed required skill as level zero", () => {
    const fixture = fixtureDataset({
      replacementSkills: Object.fromEntries(
        Object.entries(baseDataset.indexes.employeesById.get("E0001")!.skills).filter(([skillId]) => skillId !== "SK_SQL"),
      ),
    });

    const sql = getEmployeeProfile(fixture, "E0001").skills.find((skill) => skill.skill_id === "SK_SQL");

    expect(sql).toMatchObject({ current_level: 0, required_level: 3, gap: 3 });
  });

  it("applies only post-review completed records, once each, in chronological order", () => {
    const fixture = fixtureDataset({
      employeeOverrides: { last_review_date: "2026-09-10", skills: { SK_SQL: 1 } },
      additionalEvents: [
        eventFixture({
          event_id: "EV_TEST_SQL",
          develops_skills: [{ skill_id: "SK_SQL", gain: 1, max_level: 5 }],
        }),
      ],
      history: [
        recordFixture({ record_id: "R_TEST_BEFORE", event_id: "EV_TEST_SQL", date: "2026-09-09" }),
        recordFixture({ record_id: "R_TEST_ON", event_id: "EV_TEST_SQL", date: "2026-09-10" }),
        recordFixture({ record_id: "R_TEST_AFTER_A", event_id: "EV_TEST_SQL", date: "2026-09-11" }),
        recordFixture({ record_id: "R_TEST_AFTER_B", event_id: "EV_TEST_SQL", date: "2026-09-12" }),
      ],
    });
    const employee = fixture.indexes.employeesById.get("E0001")!;

    expect(reconstructCurrentSkills(fixture, employee).get("SK_SQL")).toBe(3);
    expect(employee.skills.SK_SQL).toBe(1);
  });

  it("respects event max_level and the global level-five cap", () => {
    const eventMaxFixture = fixtureDataset({
      employeeOverrides: { last_review_date: "2026-09-10", skills: { SK_SQL: 2 } },
      additionalEvents: [
        eventFixture({
          event_id: "EV_TEST_EVENT_CAP",
          develops_skills: [{ skill_id: "SK_SQL", gain: 3, max_level: 3 }],
        }),
      ],
      history: [recordFixture({ event_id: "EV_TEST_EVENT_CAP" })],
    });
    const globalCapFixture = fixtureDataset({
      employeeOverrides: { last_review_date: "2026-09-10", skills: { SK_PYTHON: 4 } },
      additionalEvents: [
        eventFixture({
          event_id: "EV_TEST_GLOBAL_CAP",
          develops_skills: [{ skill_id: "SK_PYTHON", gain: 3, max_level: 5 }],
        }),
      ],
      history: [recordFixture({ event_id: "EV_TEST_GLOBAL_CAP" })],
    });

    expect(reconstructCurrentSkills(eventMaxFixture, eventMaxFixture.indexes.employeesById.get("E0001")!).get("SK_SQL")).toBe(3);
    expect(reconstructCurrentSkills(globalCapFixture, globalCapFixture.indexes.employeesById.get("E0001")!).get("SK_PYTHON")).toBe(5);
  });

  it("marks critical skills and calculates readiness against the resolved target", () => {
    const middleProfile = baseDataset.indexes.roleProfilesByKey.get("Backend Engineer\u0000Middle");
    if (!middleProfile) throw new Error("Expected Backend Engineer/Middle profile.");
    const fixture = fixtureDataset({
      employeeOverrides: {
        last_review_date: "2026-09-30",
        skills: { ...middleProfile.required_skills, SK_PYTHON: 2 },
      },
    });

    const profile = getEmployeeProfile(fixture, "E0001");
    const python = profile.skills.find((skill) => skill.skill_id === "SK_PYTHON");
    const sql = profile.skills.find((skill) => skill.skill_id === "SK_SQL");

    expect(python).toMatchObject({ critical: true, current_level: 2, required_level: 3, gap: 1 });
    expect(sql).toMatchObject({ critical: false, current_level: 3, required_level: 3, gap: 0 });
    expect(profile.readiness).toEqual({
      requirements_met: middleProfile.critical_skills.length === 2 ? 14 : expect.any(Number),
      requirements_total: 15,
      critical_requirements_met: 1,
      critical_requirements_total: 2,
    });
  });

  it("enriches employee history and sorts it newest first", () => {
    const fixture = fixtureDataset({
      additionalEvents: [
        eventFixture({ event_id: "EV_TEST_OLDER", title: "Older activity" }),
        eventFixture({ event_id: "EV_TEST_NEWER", title: "Newer activity" }),
      ],
      history: [
        recordFixture({ record_id: "R_TEST_OLDER", event_id: "EV_TEST_OLDER", date: "2026-09-11" }),
        recordFixture({ record_id: "R_TEST_NEWER", event_id: "EV_TEST_NEWER", date: "2026-09-12" }),
      ],
    });

    expect(getEmployeeProfile(fixture, "E0001").history).toEqual([
      {
        record_id: "R_TEST_NEWER",
        event_id: "EV_TEST_NEWER",
        event_title: "Newer activity",
        date: "2026-09-12",
        status: "completed",
      },
      {
        record_id: "R_TEST_OLDER",
        event_id: "EV_TEST_OLDER",
        event_title: "Older activity",
        date: "2026-09-11",
        status: "completed",
      },
    ]);
  });
});
