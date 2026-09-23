import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { ActiveDataset, Employee, Event } from "../src/domain/types.js";
import { ActiveDatasetStore, buildActiveDataset, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import { completeActivity } from "../src/services/completion-service.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");
let baseDataset: ActiveDataset;

function eventFixture(overrides: Partial<Event>): Event {
  return {
    event_id: "EV_COMPLETE",
    title: "Completion fixture",
    description: "Controlled completion fixture.",
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

function fixtureStore({
  employeeOverrides = {},
  additionalEvents = [],
}: {
  employeeOverrides?: Partial<Employee>;
  additionalEvents?: Event[];
} = {}): ActiveDatasetStore {
  const sourceEmployee = baseDataset.indexes.employeesById.get("E0001");
  if (!sourceEmployee) throw new Error("Expected E0001 in starter data.");
  const employee: Employee = {
    ...sourceEmployee,
    ...employeeOverrides,
    skills: { ...sourceEmployee.skills, ...employeeOverrides.skills },
  };
  const activeDataset = buildActiveDataset({
    ...baseDataset.dataset,
    employees: baseDataset.dataset.employees.map((item) => item.employee_id === employee.employee_id ? employee : item),
    events: [...baseDataset.dataset.events, ...additionalEvents],
    activityHistory: baseDataset.dataset.activityHistory.filter((record) => record.employee_id !== employee.employee_id),
  });
  return new ActiveDatasetStore(activeDataset);
}

describe("activity completion", () => {
  beforeAll(async () => {
    baseDataset = await loadDatasetFromDirectory(dataDirectory);
  });

  it("adds one history record, returns actual skill changes, and recalculates profile/recommendations", () => {
    const event = eventFixture({ event_id: "EV_COMPLETE_SQL" });
    const store = fixtureStore({ additionalEvents: [event] });
    const beforeHistoryCount = store.get().dataset.activityHistory.length;
    const beforeProfileSql = store.get().indexes.employeesById.get("E0001")!.skills.SK_SQL;
    const beforeRecommendations = store.get().dataset.events.length;

    const response = completeActivity(store, "E0001", event.event_id);
    const active = store.get();
    const afterSql = response.profile.skills.find((skill) => skill.skill_id === "SK_SQL");

    expect(response).toMatchObject({
      employee_id: "E0001",
      event_id: "EV_COMPLETE_SQL",
      record_id: "R002744",
      status: "completed",
      completed_on: "2026-10-01",
      skill_changes: [{ skill_id: "SK_SQL", previous_level: 2, new_level: 3, gain_applied: 1 }],
    });
    expect(active.dataset.activityHistory).toHaveLength(beforeHistoryCount + 1);
    expect(active.indexes.activityByRecordId.get(response.record_id)).toMatchObject({ status: "completed", completion_pct: 100 });
    expect(active.indexes.employeesById.get("E0001")!.skills.SK_SQL).toBe(beforeProfileSql);
    expect(afterSql).toMatchObject({ current_level: 3, required_level: 3, gap: 0 });
    expect(response.recommendations).not.toEqual([]);
    expect(beforeRecommendations).toBeGreaterThan(0);
  });

  it("respects event max_level and global level five when reporting changes", () => {
    const eventCapped = eventFixture({
      event_id: "EV_COMPLETE_EVENT_CAP",
      develops_skills: [{ skill_id: "SK_SQL", gain: 3, max_level: 3 }],
    });
    const globalCapped = eventFixture({
      event_id: "EV_COMPLETE_GLOBAL_CAP",
      develops_skills: [{ skill_id: "SK_SYSTEM_DESIGN", gain: 3, max_level: 5 }],
    });
    const eventCapStore = fixtureStore({ additionalEvents: [eventCapped], employeeOverrides: { skills: { SK_SQL: 2 } } });
    const globalCapStore = fixtureStore({
      additionalEvents: [globalCapped],
      employeeOverrides: {
        skills: { SK_SYSTEM_DESIGN: 4 },
        career_goal: { target_role: "Backend Engineer", target_grade: "Lead" },
      },
    });

    expect(completeActivity(eventCapStore, "E0001", eventCapped.event_id).skill_changes).toEqual([
      { skill_id: "SK_SQL", previous_level: 2, new_level: 3, gain_applied: 1 },
    ]);
    expect(completeActivity(globalCapStore, "E0001", globalCapped.event_id).skill_changes).toEqual([
      { skill_id: "SK_SYSTEM_DESIGN", previous_level: 4, new_level: 5, gain_applied: 1 },
    ]);
  });

  it("rejects duplicate, unknown, and ineligible completions without mutating active state", () => {
    const eligible = eventFixture({ event_id: "EV_COMPLETE_DUPLICATE" });
    const ineligible = eventFixture({ event_id: "EV_COMPLETE_INELIGIBLE", mandatory: true });
    const store = fixtureStore({ additionalEvents: [eligible, ineligible] });
    const before = store.get();
    const beforeHistoryIds = before.dataset.activityHistory.map((record) => record.record_id);

    completeActivity(store, "E0001", eligible.event_id);
    const afterSuccessHistoryIds = store.get().dataset.activityHistory.map((record) => record.record_id);
    expect(() => completeActivity(store, "E0001", eligible.event_id)).toThrow("already been completed");
    expect(store.get().dataset.activityHistory.map((record) => record.record_id)).toEqual(afterSuccessHistoryIds);

    const untouchedStore = fixtureStore({ additionalEvents: [ineligible] });
    const untouchedHistoryIds = untouchedStore.get().dataset.activityHistory.map((record) => record.record_id);
    expect(() => completeActivity(untouchedStore, "E_UNKNOWN", "EV_COMPLETE_INELIGIBLE")).toThrow("was not found");
    expect(() => completeActivity(untouchedStore, "E0001", "EV_UNKNOWN")).toThrow("was not found");
    expect(() => completeActivity(untouchedStore, "E0001", ineligible.event_id)).toThrow("not currently completable");
    expect(untouchedStore.get().dataset.activityHistory.map((record) => record.record_id)).toEqual(untouchedHistoryIds);
    expect(beforeHistoryIds).not.toEqual(afterSuccessHistoryIds);
  });
});
