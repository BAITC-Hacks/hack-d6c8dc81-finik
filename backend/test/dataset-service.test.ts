import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DatasetValidationError } from "../src/domain/errors.js";
import {
  buildActiveDataset,
  loadDatasetFromDirectory,
  parseActivityHistoryCsv,
} from "../src/services/dataset-service.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");

describe("dataset loading and validation", () => {
  it("loads and indexes the supplied starter-kit dataset", async () => {
    const activeDataset = await loadDatasetFromDirectory(dataDirectory);

    expect(activeDataset.dataset.snapshotDate).toBe("2026-10-01");
    expect(activeDataset.dataset.skills).toHaveLength(60);
    expect(activeDataset.dataset.roleProfiles).toHaveLength(32);
    expect(activeDataset.dataset.employees).toHaveLength(200);
    expect(activeDataset.dataset.events).toHaveLength(40);
    expect(activeDataset.dataset.activityHistory).toHaveLength(2743);
    expect(activeDataset.indexes.employeesById.get("E0001")?.full_name).toBe("Marat Yessenov");
    expect(activeDataset.indexes.historyByEmployeeId.get("E0001")).toBeDefined();
  });

  it("rejects duplicate employee IDs before creating active state", async () => {
    const activeDataset = await loadDatasetFromDirectory(dataDirectory);
    const duplicateDataset = {
      ...activeDataset.dataset,
      employees: [...activeDataset.dataset.employees, activeDataset.dataset.employees[0]],
    };

    expect(() => buildActiveDataset(duplicateDataset)).toThrow(DatasetValidationError);
    expect(() => buildActiveDataset(duplicateDataset)).toThrow("Duplicate employee_id: E0001.");
  });

  it("rejects history records that reference an unknown event", async () => {
    const activeDataset = await loadDatasetFromDirectory(dataDirectory);
    const firstRecord = activeDataset.dataset.activityHistory[0];
    const invalidDataset = {
      ...activeDataset.dataset,
      activityHistory: [{ ...firstRecord, event_id: "EV_UNKNOWN" }],
    };

    expect(() => buildActiveDataset(invalidDataset)).toThrow(
      "History record R000001 references unknown event EV_UNKNOWN.",
    );
  });

  it("normalizes CSV numeric and optional fields", () => {
    const [record] = parseActivityHistoryCsv([
      "record_id,employee_id,event_id,date,due_date,status,completion_pct,score,feedback_rating,assigned_by",
      "R_TEST,E_TEST,EV_TEST,2026-10-01,,completed,100,92,5,self",
    ].join("\n"));

    expect(record).toEqual({
      record_id: "R_TEST",
      employee_id: "E_TEST",
      event_id: "EV_TEST",
      date: "2026-10-01",
      due_date: null,
      status: "completed",
      completion_pct: 100,
      score: 92,
      feedback_rating: 5,
      assigned_by: "self",
    });
  });
});
