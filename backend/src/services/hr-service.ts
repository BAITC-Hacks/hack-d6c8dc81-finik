import type { ActiveDataset, Event } from "../domain/types.js";
import { getEmployeeProfile } from "./profile-service.js";
import { getEmployeeRecommendations } from "./recommendation-service.js";

export interface HrSkillGapItem {
  skill_id: string;
  name: string;
  employee_count: number;
}

export interface HrParticipationItem {
  event_id: string;
  title: string;
  completed: number;
  no_show: number;
  dropped: number;
}

export interface HrEmployeeWithoutStepItem {
  employee_id: string;
  full_name: string;
  role: string;
  grade: string;
}

export interface HrOverviewResponse {
  employee_count: number;
  completed_activity_count: number;
  top_skill_gaps: HrSkillGapItem[];
  participation_by_event: HrParticipationItem[];
  employees_without_step: HrEmployeeWithoutStepItem[];
}

function compareSkillGaps(left: HrSkillGapItem, right: HrSkillGapItem): number {
  return right.employee_count - left.employee_count ||
    left.name.localeCompare(right.name) ||
    left.skill_id.localeCompare(right.skill_id);
}

function participationItem(event: Event): HrParticipationItem {
  return {
    event_id: event.event_id,
    title: event.title,
    completed: 0,
    no_show: 0,
    dropped: 0,
  };
}

/**
 * All HR aggregates are calculated from the active in-memory dataset. Event
 * rows and no-step employees are ordered by ID so an import cannot make the
 * response order depend on the order in which files were supplied.
 */
export function getHrOverview(activeDataset: ActiveDataset): HrOverviewResponse {
  const skillGapCounts = new Map<string, HrSkillGapItem>();
  const employeesWithoutStep: HrEmployeeWithoutStepItem[] = [];
  const participationByEvent = new Map(
    activeDataset.dataset.events.map((event) => [event.event_id, participationItem(event)]),
  );
  let completedActivityCount = 0;

  for (const record of activeDataset.dataset.activityHistory) {
    const participation = participationByEvent.get(record.event_id);
    if (!participation) {
      throw new Error(`History record ${record.record_id} references an unavailable event.`);
    }
    if (record.status === "completed") {
      completedActivityCount += 1;
      participation.completed += 1;
    } else if (record.status === "no_show") {
      participation.no_show += 1;
    } else if (record.status === "dropped") {
      participation.dropped += 1;
    }
  }

  for (const employee of activeDataset.dataset.employees) {
    const profile = getEmployeeProfile(activeDataset, employee.employee_id);
    for (const skill of profile.skills) {
      if (skill.gap <= 0) {
        continue;
      }
      const existing = skillGapCounts.get(skill.skill_id);
      if (existing) {
        existing.employee_count += 1;
      } else {
        skillGapCounts.set(skill.skill_id, {
          skill_id: skill.skill_id,
          name: skill.name,
          employee_count: 1,
        });
      }
    }

    if (getEmployeeRecommendations(activeDataset, employee.employee_id).recommendations.length === 0) {
      employeesWithoutStep.push({
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        role: employee.role,
        grade: employee.grade,
      });
    }
  }

  return {
    employee_count: activeDataset.dataset.employees.length,
    completed_activity_count: completedActivityCount,
    top_skill_gaps: [...skillGapCounts.values()].sort(compareSkillGaps),
    participation_by_event: [...participationByEvent.values()].sort(
      (left, right) => left.event_id.localeCompare(right.event_id),
    ),
    employees_without_step: employeesWithoutStep.sort(
      (left, right) => left.employee_id.localeCompare(right.employee_id),
    ),
  };
}
