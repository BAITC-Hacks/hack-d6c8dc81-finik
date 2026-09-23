import type { ActiveDataset } from "../domain/types.js";
import { getEmployeeProfile } from "./profile-service.js";
import { getEmployeeRecommendations } from "./recommendation-service.js";

export function getHrOverview(active: ActiveDataset) {
  const gaps = new Map<string, { skill_id: string; name: string; employee_count: number }>();
  const employeesWithoutStep = [];
  for (const employee of active.dataset.employees) {
    const profile = getEmployeeProfile(active, employee.employee_id);
    for (const skill of profile.skills) {
      if (skill.gap === 0) continue;
      const gap = gaps.get(skill.skill_id) ?? { skill_id: skill.skill_id, name: skill.name, employee_count: 0 };
      gap.employee_count += 1;
      gaps.set(skill.skill_id, gap);
    }
    if (getEmployeeRecommendations(active, employee.employee_id).recommendations.length === 0) {
      employeesWithoutStep.push({
        employee_id: employee.employee_id, full_name: employee.full_name, role: employee.role, grade: employee.grade,
      });
    }
  }
  const participation = new Map(active.dataset.events.map((event) => [event.event_id, {
    event_id: event.event_id, title: event.title, completed: 0, no_show: 0, dropped: 0,
  }]));
  let completedActivityCount = 0;
  for (const record of active.dataset.activityHistory) {
    if (record.status === "completed") completedActivityCount += 1;
    const event = participation.get(record.event_id);
    if (event && (record.status === "completed" || record.status === "no_show" || record.status === "dropped")) {
      event[record.status] += 1;
    }
  }
  return {
    employee_count: active.dataset.employees.length,
    completed_activity_count: completedActivityCount,
    top_skill_gaps: [...gaps.values()].sort((a, b) => b.employee_count - a.employee_count || a.skill_id.localeCompare(b.skill_id)),
    participation_by_event: [...participation.values()],
    employees_without_step: employeesWithoutStep,
  };
}
