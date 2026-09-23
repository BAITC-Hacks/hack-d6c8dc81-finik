import { basename } from "node:path";

import { DatasetValidationError, HttpError } from "../domain/errors.js";
import type { ActivityHistoryRecord, DatasetMeta, Employee, Event, RoleProfile, Skill } from "../domain/types.js";
import {
  ActiveDatasetStore,
  buildActiveDataset,
  parseActivityHistoryCsv,
  parseEmployeesDocument,
  parseEventsDocument,
  parseSkillsDocument,
} from "./dataset-service.js";

const supportedFilenames = new Set(["employees.json", "events.json", "skills.json", "activity_history.csv"]);

export interface ImportFile {
  originalname: string;
  buffer: Buffer;
}

export interface ImportResponse {
  loaded: { employees: number; events: number; skills: number; history: number };
  total: { employees: number; events: number; skills: number; history: number };
  imported_employee_ids: string[];
}

function mergeById<T>(existing: T[], incoming: T[], getId: (item: T) => string): T[] {
  const incomingById = new Map(incoming.map((item) => [getId(item), item]));
  const existingIds = new Set(existing.map(getId));
  return [
    ...existing.map((item) => incomingById.get(getId(item)) ?? item),
    ...incoming.filter((item) => !existingIds.has(getId(item))),
  ];
}

function verifySnapshot(meta: DatasetMeta, snapshotDate: string, filename: string): void {
  if (meta.as_of_date !== snapshotDate) {
    throw new HttpError(400, "INVALID_IMPORT", `${filename} snapshot date must match the active dataset.`);
  }
}

export function importDataset(datasetStore: ActiveDatasetStore, files: ImportFile[]): ImportResponse {
  try {
    if (files.length === 0) {
      throw new HttpError(400, "INVALID_IMPORT", "At least one file must be uploaded in the files field.");
    }

    const normalizedFiles = files.map((file) => ({ ...file, filename: basename(file.originalname) }));
    const filenames = normalizedFiles.map((file) => file.filename);
    if (filenames.some((filename) => !supportedFilenames.has(filename))) {
      throw new HttpError(400, "INVALID_IMPORT", "Only employees.json, events.json, skills.json, and activity_history.csv are supported.");
    }
    if (new Set(filenames).size !== filenames.length) {
      throw new HttpError(400, "INVALID_IMPORT", "A filename may be uploaded only once per import.");
    }

    const activeDataset = datasetStore.get();
    let employees: Employee[] | undefined;
    let events: Event[] | undefined;
    let skills: Skill[] | undefined;
    let roleProfiles: RoleProfile[] | undefined;
    let history: ActivityHistoryRecord[] | undefined;
    let importedEmployeeIds: string[] = [];

    for (const file of normalizedFiles) {
      const content = file.buffer.toString("utf8");
      if (file.filename === "employees.json") {
        const parsed = parseEmployeesDocument(content);
        verifySnapshot(parsed.meta, activeDataset.dataset.snapshotDate, file.filename);
        employees = parsed.employees;
        importedEmployeeIds = parsed.employees.map((employee) => employee.employee_id);
      } else if (file.filename === "events.json") {
        const parsed = parseEventsDocument(content);
        verifySnapshot(parsed.meta, activeDataset.dataset.snapshotDate, file.filename);
        events = parsed.events;
      } else if (file.filename === "skills.json") {
        const parsed = parseSkillsDocument(content);
        verifySnapshot(parsed.meta, activeDataset.dataset.snapshotDate, file.filename);
        skills = parsed.skills;
        roleProfiles = parsed.roleProfiles;
      } else {
        history = parseActivityHistoryCsv(content);
      }
    }

    const prospectiveDataset = buildActiveDataset({
      snapshotDate: activeDataset.dataset.snapshotDate,
      skills: skills ?? activeDataset.dataset.skills,
      roleProfiles: roleProfiles ?? activeDataset.dataset.roleProfiles,
      employees: employees
        ? mergeById(activeDataset.dataset.employees, employees, (employee) => employee.employee_id)
        : activeDataset.dataset.employees,
      events: events ?? activeDataset.dataset.events,
      activityHistory: history
        ? mergeById(activeDataset.dataset.activityHistory, history, (record) => record.record_id)
        : activeDataset.dataset.activityHistory,
    });

    datasetStore.replace(prospectiveDataset);
    return {
      loaded: {
        employees: employees?.length ?? 0,
        events: events?.length ?? 0,
        skills: skills?.length ?? 0,
        history: history?.length ?? 0,
      },
      total: {
        employees: prospectiveDataset.dataset.employees.length,
        events: prospectiveDataset.dataset.events.length,
        skills: prospectiveDataset.dataset.skills.length,
        history: prospectiveDataset.dataset.activityHistory.length,
      },
      imported_employee_ids: importedEmployeeIds,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (error instanceof DatasetValidationError) {
      throw new HttpError(400, "INVALID_IMPORT", error.message);
    }
    throw error;
  }
}
