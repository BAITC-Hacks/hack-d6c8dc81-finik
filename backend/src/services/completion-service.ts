import { HttpError } from "../domain/errors.js";
import type { ActivityHistoryRecord } from "../domain/types.js";
import { buildActiveDataset, type ActiveDatasetStore } from "./dataset-service.js";
import { getEmployeeProfile, reconstructCurrentSkills, resolveTargetProfile, type EmployeeProfileResponse } from "./profile-service.js";
import { evaluateRecommendationCandidate, getEmployeeRecommendations, type RecommendationItem } from "./recommendation-service.js";

export interface SkillChange {
  skill_id: string;
  previous_level: number;
  new_level: number;
  gain_applied: number;
}

export interface CompletionResponse {
  employee_id: string;
  event_id: string;
  record_id: string;
  status: "completed";
  completed_on: string;
  skill_changes: SkillChange[];
  profile: EmployeeProfileResponse;
  recommendations: RecommendationItem[];
}

function nextRecordId(records: ActivityHistoryRecord[]): string {
  const usedIds = new Set(records.map((record) => record.record_id));
  const largestNumericId = records.reduce((largest, record) => {
    const match = /^R(\d+)$/.exec(record.record_id);
    return match ? Math.max(largest, Number(match[1])) : largest;
  }, 0);
  let next = largestNumericId + 1;
  let candidate = `R${String(next).padStart(6, "0")}`;
  while (usedIds.has(candidate)) {
    next += 1;
    candidate = `R${String(next).padStart(6, "0")}`;
  }
  return candidate;
}

function createSkillChanges(
  event: ReturnType<typeof getEvent>,
  currentSkills: Map<string, number>,
): SkillChange[] {
  return event.develops_skills.flatMap((effect) => {
    const previousLevel = currentSkills.get(effect.skill_id) ?? 0;
    const newLevel = Math.min(5, effect.max_level, previousLevel + effect.gain);
    if (newLevel === previousLevel) {
      return [];
    }
    return [{
      skill_id: effect.skill_id,
      previous_level: previousLevel,
      new_level: newLevel,
      gain_applied: newLevel - previousLevel,
    }];
  });
}

function getEvent(activeDataset: ReturnType<ActiveDatasetStore["get"]>, eventId: string) {
  const event = activeDataset.indexes.eventsById.get(eventId);
  if (!event) {
    throw new HttpError(404, "EVENT_NOT_FOUND", `Event ${eventId} was not found.`);
  }
  return event;
}

export function completeActivity(
  datasetStore: ActiveDatasetStore,
  employeeId: string,
  eventId: string,
): CompletionResponse {
  const activeDataset = datasetStore.get();
  const employee = activeDataset.indexes.employeesById.get(employeeId);
  if (!employee) {
    throw new HttpError(404, "EMPLOYEE_NOT_FOUND", `Employee ${employeeId} was not found.`);
  }

  const event = getEvent(activeDataset, eventId);
  const employeeHistory = activeDataset.indexes.historyByEmployeeId.get(employeeId) ?? [];
  if (employeeHistory.some((record) => record.event_id === eventId && record.status === "completed")) {
    throw new HttpError(409, "EVENT_ALREADY_COMPLETED", `Event ${eventId} has already been completed by employee ${employeeId}.`);
  }

  const currentSkills = reconstructCurrentSkills(activeDataset, employee);
  const targetProfile = resolveTargetProfile(activeDataset, employee);
  if (!evaluateRecommendationCandidate(activeDataset, employee, targetProfile, currentSkills, event)) {
    throw new HttpError(400, "ACTIVITY_NOT_COMPLETABLE", `Event ${eventId} is not currently completable by employee ${employeeId}.`);
  }

  const completedOn = activeDataset.dataset.snapshotDate;
  const recordId = nextRecordId(activeDataset.dataset.activityHistory);
  const skillChanges = createSkillChanges(event, currentSkills);
  const completionRecord: ActivityHistoryRecord = {
    record_id: recordId,
    employee_id: employeeId,
    event_id: eventId,
    date: completedOn,
    due_date: null,
    status: "completed",
    completion_pct: 100,
    score: null,
    feedback_rating: null,
    assigned_by: "self",
  };

  // Build and calculate against an isolated prospective state. The active
  // store changes only after every validation and response calculation works.
  const prospectiveDataset = buildActiveDataset({
    ...activeDataset.dataset,
    activityHistory: [...activeDataset.dataset.activityHistory, completionRecord],
  });
  const profile = getEmployeeProfile(prospectiveDataset, employeeId);
  const recommendations = getEmployeeRecommendations(prospectiveDataset, employeeId).recommendations;

  datasetStore.replace(prospectiveDataset);
  return {
    employee_id: employeeId,
    event_id: eventId,
    record_id: recordId,
    status: "completed",
    completed_on: completedOn,
    skill_changes: skillChanges,
    profile,
    recommendations,
  };
}
