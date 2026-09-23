import { HttpError } from "../domain/errors.js";
import type {
  ActiveDataset,
  ActivityHistoryRecord,
  Employee,
  Grade,
  RoleProfile,
} from "../domain/types.js";

const gradeOrder: Grade[] = ["Junior", "Middle", "Senior", "Lead"];

export interface ProfileSkill {
  skill_id: string;
  name: string;
  current_level: number;
  required_level: number;
  gap: number;
  critical: boolean;
}

export interface ProfileHistoryItem {
  record_id: string;
  event_id: string;
  event_title: string;
  date: string;
  status: ActivityHistoryRecord["status"];
}

export interface EmployeeProfileResponse {
  employee_id: string;
  full_name: string;
  role: string;
  grade: Grade;
  target_role: string;
  target_grade: Grade;
  tenure_months: number;
  skills: ProfileSkill[];
  history: ProfileHistoryItem[];
  readiness: {
    requirements_met: number;
    requirements_total: number;
    critical_requirements_met: number;
    critical_requirements_total: number;
  };
}

function roleProfileKey(role: string, grade: Grade): string {
  return `${role}\u0000${grade}`;
}

function compareSkills(left: ProfileSkill, right: ProfileSkill): number {
  if (left.name < right.name) {
    return -1;
  }
  if (left.name > right.name) {
    return 1;
  }
  return left.skill_id.localeCompare(right.skill_id);
}

function compareHistoryNewestFirst(left: ActivityHistoryRecord, right: ActivityHistoryRecord): number {
  return right.date.localeCompare(left.date) || right.record_id.localeCompare(left.record_id);
}

export function reconstructCurrentSkills(activeDataset: ActiveDataset, employee: Employee): Map<string, number> {
  const currentSkills = new Map(Object.entries(employee.skills));
  const qualifyingRecords = (activeDataset.indexes.historyByEmployeeId.get(employee.employee_id) ?? [])
    .filter((record) => record.status === "completed" && record.date > employee.last_review_date)
    .sort((left, right) => left.date.localeCompare(right.date) || left.record_id.localeCompare(right.record_id));

  for (const record of qualifyingRecords) {
    const event = activeDataset.indexes.eventsById.get(record.event_id);
    if (!event) {
      continue;
    }

    for (const effect of event.develops_skills) {
      const previousLevel = currentSkills.get(effect.skill_id) ?? 0;
      const nextLevel = Math.min(5, effect.max_level, previousLevel + effect.gain);
      currentSkills.set(effect.skill_id, nextLevel);
    }
  }

  return currentSkills;
}

export function resolveTargetProfile(activeDataset: ActiveDataset, employee: Employee): RoleProfile {
  if (employee.career_goal) {
    const goalProfile = activeDataset.indexes.roleProfilesByKey.get(
      roleProfileKey(employee.career_goal.target_role, employee.career_goal.target_grade),
    );
    if (goalProfile) {
      return goalProfile;
    }
  }

  const roleLadder = activeDataset.dataset.roleProfiles
    .filter((profile) => profile.role === employee.role)
    .sort((left, right) => gradeOrder.indexOf(left.grade) - gradeOrder.indexOf(right.grade));
  const currentIndex = roleLadder.findIndex((profile) => profile.grade === employee.grade);
  const currentProfile = activeDataset.indexes.roleProfilesByKey.get(roleProfileKey(employee.role, employee.grade));

  if (currentIndex === -1 || !currentProfile) {
    throw new Error(`Employee ${employee.employee_id} has no current role profile.`);
  }

  return roleLadder[currentIndex + 1] ?? currentProfile;
}

function buildHistory(activeDataset: ActiveDataset, employeeId: string): ProfileHistoryItem[] {
  return [...(activeDataset.indexes.historyByEmployeeId.get(employeeId) ?? [])]
    .sort(compareHistoryNewestFirst)
    .flatMap((record) => {
      const event = activeDataset.indexes.eventsById.get(record.event_id);
      if (!event) {
        return [];
      }
      return [{
        record_id: record.record_id,
        event_id: record.event_id,
        event_title: event.title,
        date: record.date,
        status: record.status,
      }];
    });
}

export function getEmployeeProfile(activeDataset: ActiveDataset, employeeId: string): EmployeeProfileResponse {
  const employee = activeDataset.indexes.employeesById.get(employeeId);
  if (!employee) {
    throw new HttpError(404, "EMPLOYEE_NOT_FOUND", `Employee ${employeeId} was not found.`);
  }

  const targetProfile = resolveTargetProfile(activeDataset, employee);
  const currentSkills = reconstructCurrentSkills(activeDataset, employee);
  const criticalSkills = new Set(targetProfile.critical_skills);
  const skills = Object.entries(targetProfile.required_skills)
    .map(([skillId, requiredLevel]) => {
      const skill = activeDataset.indexes.skillsById.get(skillId);
      if (!skill) {
        throw new Error(`Target profile references unknown skill ${skillId}.`);
      }
      const currentLevel = currentSkills.get(skillId) ?? 0;
      return {
        skill_id: skillId,
        name: skill.name,
        current_level: currentLevel,
        required_level: requiredLevel,
        gap: Math.max(0, requiredLevel - currentLevel),
        critical: criticalSkills.has(skillId),
      };
    })
    .sort(compareSkills);
  const criticalRequirements = skills.filter((skill) => skill.critical);

  return {
    employee_id: employee.employee_id,
    full_name: employee.full_name,
    role: employee.role,
    grade: employee.grade,
    target_role: targetProfile.role,
    target_grade: targetProfile.grade,
    tenure_months: employee.tenure_months,
    skills,
    history: buildHistory(activeDataset, employee.employee_id),
    readiness: {
      requirements_met: skills.filter((skill) => skill.current_level >= skill.required_level).length,
      requirements_total: skills.length,
      critical_requirements_met: criticalRequirements.filter((skill) => skill.current_level >= skill.required_level).length,
      critical_requirements_total: criticalRequirements.length,
    },
  };
}
