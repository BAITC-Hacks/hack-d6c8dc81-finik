import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { ActiveDataset, ActivityHistoryRecord, Employee } from "../src/domain/types.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import { getEmployeeProfile } from "../src/services/profile-service.js";
import { getEmployeeRecommendations } from "../src/services/recommendation-service.js";
import { getHrOverview } from "../src/services/hr-service.js";
import { importDataset, type ImportFile } from "../src/services/import-service.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");
const meta = { dataset: "Career Quest", version: "1.0", as_of_date: "2026-10-01" };
let baseDataset: ActiveDataset;

function upload(originalname: string, content: string): ImportFile {
  return { originalname, buffer: Buffer.from(content, "utf8") };
}

function csvValue(value: string | number | null): string {
  return value === null ? "" : String(value);
}

function historyDocument(records: ActivityHistoryRecord[]): string {
  const headers = ["record_id", "employee_id", "event_id", "date", "due_date", "status", "completion_pct", "score", "feedback_rating", "assigned_by"];
  const lines = records.map((record) => [
    record.record_id, record.employee_id, record.event_id, record.date, record.due_date, record.status,
    record.completion_pct, record.score, record.feedback_rating, record.assigned_by,
  ].map(csvValue).join(","));
  return [headers.join(","), ...lines].join("\n");
}

function expectedGapCounts(activeDataset: ActiveDataset): Map<string, number> {
  const counts = new Map<string, number>();
  for (const employee of activeDataset.dataset.employees) {
    for (const skill of getEmployeeProfile(activeDataset, employee.employee_id).skills) {
      if (skill.gap > 0) {
        counts.set(skill.skill_id, (counts.get(skill.skill_id) ?? 0) + 1);
      }
    }
  }
  return counts;
}

describe("HR overview", () => {
  beforeAll(async () => {
    baseDataset = await loadDatasetFromDirectory(dataDirectory);
  });

  it("counts active employees, completed records, and positive target gaps once per employee", () => {
    const overview = getHrOverview(baseDataset);
    const expectedCounts = expectedGapCounts(baseDataset);
    const e0001Profile = getEmployeeProfile(baseDataset, "E0001");
    const e0001PositiveGap = e0001Profile.skills.find((skill) => skill.gap > 0);
    if (!e0001PositiveGap) throw new Error("Expected E0001 to have a target skill gap.");

    expect(overview.employee_count).toBe(baseDataset.dataset.employees.length);
    expect(overview.completed_activity_count).toBe(
      baseDataset.dataset.activityHistory.filter((record) => record.status === "completed").length,
    );
    expect(overview.top_skill_gaps).toEqual(expect.arrayContaining(
      [...expectedCounts.entries()].map(([skillId, employeeCount]) => ({
        skill_id: skillId,
        name: baseDataset.indexes.skillsById.get(skillId)?.name,
        employee_count: employeeCount,
      })),
    ));
    expect(overview.top_skill_gaps.find((item) => item.skill_id === e0001PositiveGap.skill_id)?.employee_count).toBe(
      [...baseDataset.dataset.employees].filter((employee) =>
        getEmployeeProfile(baseDataset, employee.employee_id).skills.some(
          (skill) => skill.skill_id === e0001PositiveGap.skill_id && skill.gap > 0,
        )
      ).length,
    );
  });

  it("uses stable HR ordering and aggregates the contract participation statuses", () => {
    const overview = getHrOverview(baseDataset);
    const eventId = "EV_001";
    const history = baseDataset.dataset.activityHistory.filter((record) => record.event_id === eventId);
    const participation = overview.participation_by_event.find((item) => item.event_id === eventId);

    expect(overview.top_skill_gaps).toEqual([...overview.top_skill_gaps].sort((left, right) =>
      right.employee_count - left.employee_count || left.name.localeCompare(right.name) || left.skill_id.localeCompare(right.skill_id),
    ));
    expect(overview.participation_by_event.map((item) => item.event_id)).toEqual(
      [...overview.participation_by_event.map((item) => item.event_id)].sort(),
    );
    expect(participation).toEqual({
      event_id: eventId,
      title: baseDataset.indexes.eventsById.get(eventId)?.title,
      completed: history.filter((record) => record.status === "completed").length,
      no_show: history.filter((record) => record.status === "no_show").length,
      dropped: history.filter((record) => record.status === "dropped").length,
    });
  });

  it("uses the existing recommendation engine for employees without a next step", () => {
    const overview = getHrOverview(baseDataset);
    const expected = baseDataset.dataset.employees
      .filter((employee) => getEmployeeRecommendations(baseDataset, employee.employee_id).recommendations.length === 0)
      .map((employee) => ({
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        role: employee.role,
        grade: employee.grade,
      }))
      .sort((left, right) => left.employee_id.localeCompare(right.employee_id));

    expect(overview.employees_without_step).toEqual(expected);
  });

  it("reflects imported active employees and history immediately", () => {
    const store = new ActiveDatasetStore(baseDataset);
    const sourceEmployee = baseDataset.indexes.employeesById.get("E0001");
    if (!sourceEmployee) throw new Error("Expected E0001 in starter data.");
    const employee: Employee = { ...sourceEmployee, employee_id: "JUDGE_HR_001", full_name: "Imported HR Employee" };
    const history: ActivityHistoryRecord = {
      record_id: "R_HR_IMPORT_001",
      employee_id: employee.employee_id,
      event_id: "EV_001",
      date: "2026-09-30",
      due_date: null,
      status: "completed",
      completion_pct: 100,
      score: null,
      feedback_rating: null,
      assigned_by: "self",
    };
    const before = getHrOverview(store.get());

    importDataset(store, [
      upload("employees.json", JSON.stringify({ meta, employees: [employee] })),
      upload("activity_history.csv", historyDocument([history])),
    ]);
    const after = getHrOverview(store.get());
    const beforeParticipation = before.participation_by_event.find((item) => item.event_id === history.event_id);
    const afterParticipation = after.participation_by_event.find((item) => item.event_id === history.event_id);

    expect(after.employee_count).toBe(before.employee_count + 1);
    expect(after.completed_activity_count).toBe(before.completed_activity_count + 1);
    expect(afterParticipation?.completed).toBe((beforeParticipation?.completed ?? 0) + 1);
  });
});
