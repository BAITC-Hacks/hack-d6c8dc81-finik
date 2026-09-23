import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "csv-parse/sync";

import { DatasetValidationError } from "../domain/errors.js";
import type {
  ActiveDataset,
  ActivityHistoryRecord,
  ActivityStatus,
  AssignedBy,
  CareerGoal,
  Dataset,
  DatasetIndexes,
  DatasetMeta,
  Employee,
  Event,
  EventFormat,
  EventType,
  Grade,
  PreferredLanguage,
  RoleProfile,
  Skill,
  SkillEffect,
  WorkFormat,
} from "../domain/types.js";

const grades = ["Junior", "Middle", "Senior", "Lead"] as const;
const workFormats = ["office", "hybrid", "remote"] as const;
const languages = ["kk", "ru", "en"] as const;
const eventFormats = ["online", "offline", "self_paced"] as const;
const eventTypes = [
  "compliance",
  "onboarding",
  "course",
  "workshop",
  "mentoring",
  "certification",
  "meetup",
] as const;
const activityStatuses = [
  "completed",
  "in_progress",
  "dropped",
  "no_show",
  "declined",
  "overdue",
] as const;
const assignedByValues = ["self", "manager", "hr"] as const;

type UnknownRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new DatasetValidationError(message);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, path: string): UnknownRecord {
  return isRecord(value) ? value : fail(`${path} must be an object.`);
}

function asArray(value: unknown, path: string): unknown[] {
  return Array.isArray(value) ? value : fail(`${path} must be an array.`);
}

function asString(value: unknown, path: string): string {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : fail(`${path} must be a non-empty string.`);
}

function asBoolean(value: unknown, path: string): boolean {
  return typeof value === "boolean" ? value : fail(`${path} must be a boolean.`);
}

function asInteger(value: unknown, path: string, min: number, max: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fail(`${path} must be an integer between ${min} and ${max}.`);
}

function asNumber(value: unknown, path: string, minimum: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum
    ? value
    : fail(`${path} must be a number greater than or equal to ${minimum}.`);
}

function asOneOf<T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
): T[number] {
  return typeof value === "string" && allowed.includes(value)
    ? (value as T[number])
    : fail(`${path} must be one of: ${allowed.join(", ")}.`);
}

function asDate(value: unknown, path: string): string {
  const date = asString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail(`${path} must use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    fail(`${path} must be a valid date.`);
  }

  return date;
}

function asStringArray(value: unknown, path: string): string[] {
  return asArray(value, path).map((item, index) => asString(item, `${path}[${index}]`));
}

function asSkillLevels(value: unknown, path: string): Record<string, number> {
  const record = asRecord(value, path);
  const levels: Record<string, number> = {};

  for (const [skillId, level] of Object.entries(record)) {
    if (skillId.trim() === "") {
      fail(`${path} has an empty skill ID.`);
    }
    levels[skillId] = asInteger(level, `${path}.${skillId}`, 0, 5);
  }

  return levels;
}

function normalizeMeta(value: unknown, path: string): DatasetMeta {
  const record = asRecord(value, path);
  return {
    dataset: asString(record.dataset, `${path}.dataset`),
    version: asString(record.version, `${path}.version`),
    as_of_date: asDate(record.as_of_date, `${path}.as_of_date`),
  };
}

function normalizeSkill(value: unknown, index: number): Skill {
  const path = `skills[${index}]`;
  const record = asRecord(value, path);
  return {
    skill_id: asString(record.skill_id, `${path}.skill_id`),
    name: asString(record.name, `${path}.name`),
    type: asOneOf(record.type, `${path}.type`, ["hard", "soft"] as const),
    category: asString(record.category, `${path}.category`),
    description: asString(record.description, `${path}.description`),
  };
}

function normalizeRoleProfile(value: unknown, index: number): RoleProfile {
  const path = `role_profiles[${index}]`;
  const record = asRecord(value, path);
  return {
    role: asString(record.role, `${path}.role`),
    grade: asOneOf(record.grade, `${path}.grade`, grades) as Grade,
    required_skills: asSkillLevels(record.required_skills, `${path}.required_skills`),
    critical_skills: asStringArray(record.critical_skills, `${path}.critical_skills`),
  };
}

function normalizeCareerGoal(value: unknown, path: string): CareerGoal | null {
  if (value === null) {
    return null;
  }

  const record = asRecord(value, path);
  return {
    target_role: asString(record.target_role, `${path}.target_role`),
    target_grade: asOneOf(record.target_grade, `${path}.target_grade`, grades) as Grade,
  };
}

function normalizeEmployee(value: unknown, index: number): Employee {
  const path = `employees[${index}]`;
  const record = asRecord(value, path);
  const managerId = record.manager_id;
  return {
    employee_id: asString(record.employee_id, `${path}.employee_id`),
    full_name: asString(record.full_name, `${path}.full_name`),
    department: asString(record.department, `${path}.department`),
    role: asString(record.role, `${path}.role`),
    grade: asOneOf(record.grade, `${path}.grade`, grades) as Grade,
    manager_id: managerId === null ? null : asString(managerId, `${path}.manager_id`),
    hire_date: asDate(record.hire_date, `${path}.hire_date`),
    tenure_months: asInteger(record.tenure_months, `${path}.tenure_months`, 0, Number.MAX_SAFE_INTEGER),
    work_format: asOneOf(record.work_format, `${path}.work_format`, workFormats) as WorkFormat,
    preferred_language: asOneOf(record.preferred_language, `${path}.preferred_language`, languages) as PreferredLanguage,
    career_goal: normalizeCareerGoal(record.career_goal, `${path}.career_goal`),
    skills: asSkillLevels(record.skills, `${path}.skills`),
    last_review_date: asDate(record.last_review_date, `${path}.last_review_date`),
  };
}

function normalizeSkillEffect(value: unknown, path: string): SkillEffect {
  const record = asRecord(value, path);
  return {
    skill_id: asString(record.skill_id, `${path}.skill_id`),
    gain: asInteger(record.gain, `${path}.gain`, 1, 5),
    max_level: asInteger(record.max_level, `${path}.max_level`, 0, 5),
  };
}

function normalizeEvent(value: unknown, index: number): Event {
  const path = `events[${index}]`;
  const record = asRecord(value, path);
  return {
    event_id: asString(record.event_id, `${path}.event_id`),
    title: asString(record.title, `${path}.title`),
    description: asString(record.description, `${path}.description`),
    type: asOneOf(record.type, `${path}.type`, eventTypes) as EventType,
    format: asOneOf(record.format, `${path}.format`, eventFormats) as EventFormat,
    duration_hours: asNumber(record.duration_hours, `${path}.duration_hours`, 0),
    mandatory: asBoolean(record.mandatory, `${path}.mandatory`),
    target_roles: asStringArray(record.target_roles, `${path}.target_roles`),
    target_grades: asArray(record.target_grades, `${path}.target_grades`).map((grade, gradeIndex) =>
      asOneOf(grade, `${path}.target_grades[${gradeIndex}]`, grades) as Grade,
    ),
    develops_skills: asArray(record.develops_skills, `${path}.develops_skills`).map((effect, effectIndex) =>
      normalizeSkillEffect(effect, `${path}.develops_skills[${effectIndex}]`),
    ),
    prerequisites: asSkillLevels(record.prerequisites, `${path}.prerequisites`),
    upcoming_sessions: asArray(record.upcoming_sessions, `${path}.upcoming_sessions`).map((session, sessionIndex) =>
      asDate(session, `${path}.upcoming_sessions[${sessionIndex}]`),
    ),
  };
}

function parseOptionalInteger(value: string | undefined, path: string, min: number, max: number): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= min && numberValue <= max
    ? numberValue
    : fail(`${path} must be an integer between ${min} and ${max} or empty.`);
}

function normalizeHistoryRecord(value: unknown, index: number): ActivityHistoryRecord {
  const path = `activity_history[${index}]`;
  const record = asRecord(value, path);
  const dueDate = record.due_date;
  return {
    record_id: asString(record.record_id, `${path}.record_id`),
    employee_id: asString(record.employee_id, `${path}.employee_id`),
    event_id: asString(record.event_id, `${path}.event_id`),
    date: asDate(record.date, `${path}.date`),
    due_date: dueDate === "" || dueDate === undefined ? null : asDate(dueDate, `${path}.due_date`),
    status: asOneOf(record.status, `${path}.status`, activityStatuses) as ActivityStatus,
    completion_pct: parseOptionalInteger(
      typeof record.completion_pct === "string" ? record.completion_pct : undefined,
      `${path}.completion_pct`,
      0,
      100,
    ) ?? fail(`${path}.completion_pct is required.`),
    score: parseOptionalInteger(typeof record.score === "string" ? record.score : undefined, `${path}.score`, 0, 100),
    feedback_rating: parseOptionalInteger(
      typeof record.feedback_rating === "string" ? record.feedback_rating : undefined,
      `${path}.feedback_rating`,
      1,
      5,
    ),
    assigned_by: asOneOf(record.assigned_by, `${path}.assigned_by`, assignedByValues) as AssignedBy,
  };
}

function assertUnique<T>(items: T[], key: (item: T) => string, label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) {
      fail(`Duplicate ${label}: ${value}.`);
    }
    seen.add(value);
  }
}

function roleProfileKey(role: string, grade: Grade): string {
  return `${role}\u0000${grade}`;
}

function validateHistoryStatus(record: ActivityHistoryRecord): void {
  if (record.status === "completed" && record.completion_pct !== 100) {
    fail(`History record ${record.record_id} is completed but completion_pct is not 100.`);
  }
  if ((record.status === "no_show" || record.status === "declined") && record.completion_pct !== 0) {
    fail(`History record ${record.record_id} has status ${record.status} but completion_pct is not 0.`);
  }
  if (record.status === "dropped" && (record.completion_pct < 5 || record.completion_pct > 95)) {
    fail(`History record ${record.record_id} is dropped but completion_pct is outside 5-95.`);
  }
  if ((record.status === "in_progress" || record.status === "overdue") && record.completion_pct > 95) {
    fail(`History record ${record.record_id} has status ${record.status} but completion_pct exceeds 95.`);
  }
}

export function validateDataset(dataset: Dataset): void {
  asDate(dataset.snapshotDate, "snapshotDate");
  if (dataset.skills.length === 0 || dataset.roleProfiles.length === 0 || dataset.employees.length === 0 || dataset.events.length === 0) {
    fail("The active dataset must include skills, role profiles, employees, and events.");
  }

  assertUnique(dataset.skills, (skill) => skill.skill_id, "skill_id");
  assertUnique(dataset.roleProfiles, (profile) => roleProfileKey(profile.role, profile.grade), "role/grade profile");
  assertUnique(dataset.employees, (employee) => employee.employee_id, "employee_id");
  assertUnique(dataset.events, (event) => event.event_id, "event_id");
  assertUnique(dataset.activityHistory, (record) => record.record_id, "history record_id");

  const skillIds = new Set(dataset.skills.map((skill) => skill.skill_id));
  const employeeIds = new Set(dataset.employees.map((employee) => employee.employee_id));
  const employeeById = new Map(dataset.employees.map((employee) => [employee.employee_id, employee]));
  const eventById = new Map(dataset.events.map((event) => [event.event_id, event]));
  const roleProfileKeys = new Set(dataset.roleProfiles.map((profile) => roleProfileKey(profile.role, profile.grade)));
  const roles = new Set(dataset.roleProfiles.map((profile) => profile.role));

  for (const role of roles) {
    const profilesByGrade = new Map(
      dataset.roleProfiles.filter((profile) => profile.role === role).map((profile) => [profile.grade, profile]),
    );
    const previousRequirements: Record<string, number> = {};

    for (const grade of grades) {
      const profile = profilesByGrade.get(grade);
      if (!profile) {
        fail(`Role ${role} is missing the ${grade} role profile.`);
      }

      for (const skillId of Object.keys(profile.required_skills)) {
        if (!skillIds.has(skillId)) {
          fail(`Role profile ${profile.role}/${profile.grade} references unknown skill ${skillId}.`);
        }
      }
      for (const skillId of profile.critical_skills) {
        if (!(skillId in profile.required_skills)) {
          fail(`Critical skill ${skillId} is not required by ${profile.role}/${profile.grade}.`);
        }
      }

      const requirementIds = new Set([...Object.keys(previousRequirements), ...Object.keys(profile.required_skills)]);
      for (const skillId of requirementIds) {
        const previousLevel = previousRequirements[skillId] ?? 0;
        const currentLevel = profile.required_skills[skillId] ?? 0;
        if (currentLevel < previousLevel) {
          fail(`Role profile requirements decrease for ${role}, ${skillId}, at grade ${grade}.`);
        }
      }
      Object.assign(previousRequirements, profile.required_skills);
    }
  }

  for (const profile of dataset.roleProfiles) {
    if (!roleProfileKeys.has(roleProfileKey(profile.role, profile.grade))) {
      fail(`Role profile ${profile.role}/${profile.grade} is invalid.`);
    }
  }

  for (const employee of dataset.employees) {
    if (!roleProfileKeys.has(roleProfileKey(employee.role, employee.grade))) {
      fail(`Employee ${employee.employee_id} references an unknown role/grade profile.`);
    }
    if (employee.manager_id !== null && !employeeIds.has(employee.manager_id)) {
      fail(`Employee ${employee.employee_id} references unknown manager ${employee.manager_id}.`);
    }
    if (employee.manager_id !== null) {
      const manager = employeeById.get(employee.manager_id);
      if (!manager || manager.grade !== "Lead" || manager.department !== employee.department) {
        fail(`Employee ${employee.employee_id} must reference a Lead in the same department as manager.`);
      }
    }
    if (employee.hire_date > dataset.snapshotDate || employee.last_review_date > dataset.snapshotDate) {
      fail(`Employee ${employee.employee_id} has a date after the dataset snapshot.`);
    }
    if (employee.career_goal && !roleProfileKeys.has(roleProfileKey(employee.career_goal.target_role, employee.career_goal.target_grade))) {
      fail(`Employee ${employee.employee_id} has an unknown career goal profile.`);
    }
    for (const skillId of Object.keys(employee.skills)) {
      if (!skillIds.has(skillId)) {
        fail(`Employee ${employee.employee_id} references unknown skill ${skillId}.`);
      }
    }
  }

  for (const event of dataset.events) {
    if (event.target_roles.length === 0 || event.target_grades.length === 0) {
      fail(`Event ${event.event_id} must have at least one target role and grade.`);
    }
    for (const role of event.target_roles) {
      if (!roles.has(role)) {
        fail(`Event ${event.event_id} targets unknown role ${role}.`);
      }
    }
    if (event.format === "self_paced" && event.upcoming_sessions.length !== 0) {
      fail(`Self-paced event ${event.event_id} must not have upcoming sessions.`);
    }
    if (event.format !== "self_paced" && event.upcoming_sessions.length === 0) {
      fail(`Scheduled event ${event.event_id} must have an upcoming session.`);
    }
    if (event.upcoming_sessions.some((session) => session < dataset.snapshotDate)) {
      fail(`Event ${event.event_id} has a session before the dataset snapshot.`);
    }
    for (const effect of event.develops_skills) {
      if (!skillIds.has(effect.skill_id)) {
        fail(`Event ${event.event_id} develops unknown skill ${effect.skill_id}.`);
      }
    }
    for (const skillId of Object.keys(event.prerequisites)) {
      if (!skillIds.has(skillId)) {
        fail(`Event ${event.event_id} has an unknown prerequisite skill ${skillId}.`);
      }
    }
  }

  for (const record of dataset.activityHistory) {
    if (record.date > dataset.snapshotDate) {
      fail(`History record ${record.record_id} has a date after the dataset snapshot.`);
    }
    if (!employeeIds.has(record.employee_id)) {
      fail(`History record ${record.record_id} references unknown employee ${record.employee_id}.`);
    }
    const event = eventById.get(record.event_id);
    if (!event) {
      fail(`History record ${record.record_id} references unknown event ${record.event_id}.`);
    }
    if (record.due_date !== null && !event.mandatory) {
      fail(`History record ${record.record_id} has a due date for a non-mandatory event.`);
    }
    validateHistoryStatus(record);
  }
}

export function buildActiveDataset(dataset: Dataset): ActiveDataset {
  validateDataset(dataset);
  const activityHistory = [...dataset.activityHistory].sort((left, right) =>
    left.date.localeCompare(right.date) || left.employee_id.localeCompare(right.employee_id) || left.event_id.localeCompare(right.event_id),
  );
  const normalizedDataset = { ...dataset, activityHistory };
  const historyByEmployeeId = new Map<string, ActivityHistoryRecord[]>();
  for (const record of activityHistory) {
    const records = historyByEmployeeId.get(record.employee_id) ?? [];
    records.push(record);
    historyByEmployeeId.set(record.employee_id, records);
  }

  const indexes: DatasetIndexes = {
    skillsById: new Map(normalizedDataset.skills.map((skill) => [skill.skill_id, skill])),
    roleProfilesByKey: new Map(normalizedDataset.roleProfiles.map((profile) => [roleProfileKey(profile.role, profile.grade), profile])),
    employeesById: new Map(normalizedDataset.employees.map((employee) => [employee.employee_id, employee])),
    eventsById: new Map(normalizedDataset.events.map((event) => [event.event_id, event])),
    activityByRecordId: new Map(activityHistory.map((record) => [record.record_id, record])),
    historyByEmployeeId,
  };

  return { dataset: normalizedDataset, indexes };
}

export class ActiveDatasetStore {
  constructor(private activeDataset: ActiveDataset) {}

  get(): ActiveDataset {
    return this.activeDataset;
  }

  replace(activeDataset: ActiveDataset): void {
    this.activeDataset = activeDataset;
  }
}

export interface ParsedSkillsDocument {
  meta: DatasetMeta;
  skills: Skill[];
  roleProfiles: RoleProfile[];
}

export interface ParsedEmployeesDocument {
  meta: DatasetMeta;
  employees: Employee[];
}

export interface ParsedEventsDocument {
  meta: DatasetMeta;
  events: Event[];
}

function parseJsonText(content: string, label: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown JSON error";
    fail(`Unable to parse ${label}: ${detail}`);
  }
}

async function readText(filePath: string, label: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown read error";
    fail(`Unable to read ${label}: ${detail}`);
  }
}

export function parseSkillsDocument(content: string): ParsedSkillsDocument {
  const document = asRecord(parseJsonText(content, "skills.json"), "skills.json");
  const proficiencyScale = asRecord(document.proficiency_scale, "skills.json.proficiency_scale");
  for (let level = 0; level <= 5; level += 1) {
    asString(proficiencyScale[String(level)], `skills.json.proficiency_scale.${level}`);
  }
  const skills = asArray(document.skills, "skills.json.skills").map(normalizeSkill);
  const roleProfiles = asArray(document.role_profiles, "skills.json.role_profiles").map(normalizeRoleProfile);
  assertUnique(skills, (skill) => skill.skill_id, "skill_id in skills.json");
  assertUnique(roleProfiles, (profile) => roleProfileKey(profile.role, profile.grade), "role/grade profile in skills.json");
  return { meta: normalizeMeta(document.meta, "skills.json.meta"), skills, roleProfiles };
}

export function parseEmployeesDocument(content: string): ParsedEmployeesDocument {
  const document = asRecord(parseJsonText(content, "employees.json"), "employees.json");
  const employees = asArray(document.employees, "employees.json.employees").map(normalizeEmployee);
  assertUnique(employees, (employee) => employee.employee_id, "employee_id in employees.json");
  return { meta: normalizeMeta(document.meta, "employees.json.meta"), employees };
}

export function parseEventsDocument(content: string): ParsedEventsDocument {
  const document = asRecord(parseJsonText(content, "events.json"), "events.json");
  const events = asArray(document.events, "events.json.events").map(normalizeEvent);
  assertUnique(events, (event) => event.event_id, "event_id in events.json");
  return { meta: normalizeMeta(document.meta, "events.json.meta"), events };
}

export function parseActivityHistoryCsv(content: string): ActivityHistoryRecord[] {
  let rows: unknown[];
  try {
    rows = parse(content, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as unknown[];
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown CSV error";
    fail(`Unable to parse activity_history.csv: ${detail}`);
  }

  const records = rows.map(normalizeHistoryRecord);
  assertUnique(records, (record) => record.record_id, "record_id in activity_history.csv");
  return records;
}

export async function loadDatasetFromDirectory(dataDirectory: string): Promise<ActiveDataset> {
  const [skillsContent, employeesContent, eventsContent, historyContent] = await Promise.all([
    readText(join(dataDirectory, "skills.json"), "skills.json"),
    readText(join(dataDirectory, "employees.json"), "employees.json"),
    readText(join(dataDirectory, "events.json"), "events.json"),
    readText(join(dataDirectory, "activity_history.csv"), "activity_history.csv"),
  ]);

  const skillsDocument = parseSkillsDocument(skillsContent);
  const employeesDocument = parseEmployeesDocument(employeesContent);
  const eventsDocument = parseEventsDocument(eventsContent);
  const skillsMeta = skillsDocument.meta;
  const employeesMeta = employeesDocument.meta;
  const eventsMeta = eventsDocument.meta;

  if (
    skillsMeta.dataset !== employeesMeta.dataset ||
    skillsMeta.dataset !== eventsMeta.dataset ||
    skillsMeta.version !== employeesMeta.version ||
    skillsMeta.version !== eventsMeta.version ||
    skillsMeta.as_of_date !== employeesMeta.as_of_date ||
    skillsMeta.as_of_date !== eventsMeta.as_of_date
  ) {
    fail("Dataset metadata must match across JSON files.");
  }

  const dataset: Dataset = {
    snapshotDate: skillsMeta.as_of_date,
    skills: skillsDocument.skills,
    roleProfiles: skillsDocument.roleProfiles,
    employees: employeesDocument.employees,
    events: eventsDocument.events,
    activityHistory: parseActivityHistoryCsv(historyContent),
  };

  return buildActiveDataset(dataset);
}
