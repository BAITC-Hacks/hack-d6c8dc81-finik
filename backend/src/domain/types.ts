export type Grade = "Junior" | "Middle" | "Senior" | "Lead";
export type WorkFormat = "office" | "hybrid" | "remote";
export type PreferredLanguage = "kk" | "ru" | "en";
export type EventFormat = "online" | "offline" | "self_paced";
export type EventType =
  | "compliance"
  | "onboarding"
  | "course"
  | "workshop"
  | "mentoring"
  | "certification"
  | "meetup";
export type ActivityStatus =
  | "completed"
  | "in_progress"
  | "dropped"
  | "no_show"
  | "declined"
  | "overdue";
export type AssignedBy = "self" | "manager" | "hr";

export interface DatasetMeta {
  dataset: string;
  version: string;
  as_of_date: string;
}

export interface Skill {
  skill_id: string;
  name: string;
  type: "hard" | "soft";
  category: string;
  description: string;
}

export interface RoleProfile {
  role: string;
  grade: Grade;
  required_skills: Record<string, number>;
  critical_skills: string[];
}

export interface CareerGoal {
  target_role: string;
  target_grade: Grade;
}

export interface Employee {
  employee_id: string;
  full_name: string;
  department: string;
  role: string;
  grade: Grade;
  manager_id: string | null;
  hire_date: string;
  tenure_months: number;
  work_format: WorkFormat;
  preferred_language: PreferredLanguage;
  career_goal: CareerGoal | null;
  skills: Record<string, number>;
  last_review_date: string;
}

export interface SkillEffect {
  skill_id: string;
  gain: number;
  max_level: number;
}

export interface Event {
  event_id: string;
  title: string;
  description: string;
  type: EventType;
  format: EventFormat;
  duration_hours: number;
  mandatory: boolean;
  target_roles: string[];
  target_grades: Grade[];
  develops_skills: SkillEffect[];
  prerequisites: Record<string, number>;
  upcoming_sessions: string[];
}

export interface ActivityHistoryRecord {
  record_id: string;
  employee_id: string;
  event_id: string;
  date: string;
  due_date: string | null;
  status: ActivityStatus;
  completion_pct: number;
  score: number | null;
  feedback_rating: number | null;
  assigned_by: AssignedBy;
}

export interface Dataset {
  snapshotDate: string;
  skills: Skill[];
  roleProfiles: RoleProfile[];
  employees: Employee[];
  events: Event[];
  activityHistory: ActivityHistoryRecord[];
}

export interface DatasetIndexes {
  skillsById: Map<string, Skill>;
  roleProfilesByKey: Map<string, RoleProfile>;
  employeesById: Map<string, Employee>;
  eventsById: Map<string, Event>;
  activityByRecordId: Map<string, ActivityHistoryRecord>;
  historyByEmployeeId: Map<string, ActivityHistoryRecord[]>;
}

export interface ActiveDataset {
  dataset: Dataset;
  indexes: DatasetIndexes;
}
