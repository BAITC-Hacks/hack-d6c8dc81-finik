import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { ActiveDataset, ActivityHistoryRecord, Employee, Event } from "../src/domain/types.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import { importDataset, type ImportFile } from "../src/services/import-service.js";
import { getEmployeeProfile } from "../src/services/profile-service.js";
import { getEmployeeRecommendations } from "../src/services/recommendation-service.js";
import { HttpError } from "../src/domain/errors.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");
const meta = { dataset: "Career Quest", version: "1.0", as_of_date: "2026-10-01" };
let baseDataset: ActiveDataset;

function upload(originalname: string, content: string): ImportFile {
  return { originalname, buffer: Buffer.from(content, "utf8") };
}

function expectInvalidImport(action: () => unknown): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).code).toBe("INVALID_IMPORT");
    return;
  }
  throw new Error("Expected import to fail.");
}

function employeeDocument(employees: Employee[]): string {
  return JSON.stringify({ meta, employees });
}

function eventDocument(events: Event[]): string {
  return JSON.stringify({ meta, events });
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

function newEmployee(employeeId: string): Employee {
  const source = baseDataset.indexes.employeesById.get("E0001");
  if (!source) throw new Error("Expected E0001 in starter data.");
  return { ...source, employee_id: employeeId, full_name: `Imported ${employeeId}` };
}

function newHistory(recordId: string, employeeId = "E0001"): ActivityHistoryRecord {
  return {
    record_id: recordId,
    employee_id: employeeId,
    event_id: "EV_005",
    date: "2026-09-01",
    due_date: null,
    status: "no_show",
    completion_pct: 0,
    score: null,
    feedback_rating: null,
    assigned_by: "self",
  };
}

function store(): ActiveDatasetStore {
  return new ActiveDatasetStore(baseDataset);
}

describe("atomic dataset import", () => {
  beforeAll(async () => {
    baseDataset = await loadDatasetFromDirectory(dataDirectory);
  });

  it("imports a new employee who immediately has a profile and recommendations", () => {
    const activeStore = store();
    const employee = newEmployee("JUDGE_001");

    const response = importDataset(activeStore, [upload("employees.json", employeeDocument([employee]))]);

    expect(response).toEqual({
      loaded: { employees: 1, events: 0, skills: 0, history: 0 },
      total: { employees: 201, events: 40, skills: 60, history: 2743 },
      imported_employee_ids: ["JUDGE_001"],
    });
    expect(activeStore.get().indexes.employeesById.get("JUDGE_001")?.full_name).toBe("Imported JUDGE_001");
    expect(getEmployeeProfile(activeStore.get(), "JUDGE_001").employee_id).toBe("JUDGE_001");
    expect(getEmployeeRecommendations(activeStore.get(), "JUDGE_001").recommendations).toEqual(expect.any(Array));
  });

  it("replaces employees by employee_id", () => {
    const activeStore = store();
    const replacement = { ...newEmployee("E0001"), full_name: "Replacement Employee" };

    importDataset(activeStore, [upload("employees.json", employeeDocument([replacement]))]);

    expect(activeStore.get().dataset.employees).toHaveLength(200);
    expect(activeStore.get().indexes.employeesById.get("E0001")?.full_name).toBe("Replacement Employee");
  });

  it("appends and replaces activity history records by record_id", () => {
    const activeStore = store();
    const appendRecord = newHistory("R_IMPORT_001");
    const existingRecord = baseDataset.dataset.activityHistory[0];
    const replacementRecord = { ...existingRecord, feedback_rating: 5 };

    const appendResponse = importDataset(activeStore, [upload("activity_history.csv", historyDocument([appendRecord]))]);
    const replaceResponse = importDataset(activeStore, [upload("activity_history.csv", historyDocument([replacementRecord]))]);

    expect(appendResponse.loaded.history).toBe(1);
    expect(appendResponse.total.history).toBe(2744);
    expect(replaceResponse.total.history).toBe(2744);
    expect(activeStore.get().indexes.activityByRecordId.get("R_IMPORT_001")).toMatchObject({ employee_id: "E0001" });
    expect(activeStore.get().indexes.activityByRecordId.get(existingRecord.record_id)?.feedback_rating).toBe(5);
  });

  it("imports employees and history together into one validated active state", () => {
    const activeStore = store();
    const employee = newEmployee("JUDGE_COMBO");
    const history = newHistory("R_IMPORT_COMBO", "JUDGE_COMBO");

    const response = importDataset(activeStore, [
      upload("employees.json", employeeDocument([employee])),
      upload("activity_history.csv", historyDocument([history])),
    ]);

    expect(response.loaded).toEqual({ employees: 1, events: 0, skills: 0, history: 1 });
    expect(activeStore.get().indexes.historyByEmployeeId.get("JUDGE_COMBO")).toHaveLength(1);
  });

  it("rejects invalid references and leaves active state unchanged", () => {
    const activeStore = store();
    const before = activeStore.get();
    const invalidEmployee = { ...newEmployee("JUDGE_BAD"), manager_id: "E_UNKNOWN" };
    const invalidHistory = { ...newHistory("R_IMPORT_BAD"), event_id: "EV_UNKNOWN" };
    const invalidEvents = baseDataset.dataset.events.map((event, index) => index === 0
      ? { ...event, develops_skills: [{ skill_id: "SK_UNKNOWN", gain: 1, max_level: 5 }] }
      : event);

    expectInvalidImport(() => importDataset(activeStore, [upload("employees.json", employeeDocument([invalidEmployee]))]));
    expect(activeStore.get()).toBe(before);
    expectInvalidImport(() => importDataset(activeStore, [upload("activity_history.csv", historyDocument([invalidHistory]))]));
    expect(activeStore.get()).toBe(before);
    expectInvalidImport(() => importDataset(activeStore, [upload("events.json", eventDocument(invalidEvents))]));
    expect(activeStore.get()).toBe(before);
  });

  it("rejects malformed, unsupported, and duplicate uploads without mutation", () => {
    const activeStore = store();
    const before = activeStore.get();

    expectInvalidImport(() => importDataset(activeStore, [upload("employees.json", "{not json")]));
    expectInvalidImport(() => importDataset(activeStore, [upload("activity_history.csv", "record_id,event_id\nR_BAD,EV_001")]));
    expectInvalidImport(() => importDataset(activeStore, [upload("unknown.json", "{}")]));
    expectInvalidImport(() => importDataset(activeStore, [upload("employees.json", employeeDocument([])), upload("employees.json", employeeDocument([]))]));
    expect(activeStore.get()).toBe(before);
  });
});
