import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { ActiveDataset, Event, ActivityHistoryRecord } from "../src/domain/types.js";
import { applySkillGain } from "../src/domain/skill-effects.js";
import { ActiveDatasetStore, buildActiveDataset, loadDatasetFromDirectory, parseEventsDocument } from "../src/services/dataset-service.js";
import { reconstructCurrentSkills, resolveTargetProfile } from "../src/services/profile-service.js";
import { completeActivity } from "../src/services/completion-service.js";
import { evaluateRecommendationCandidate, getEmployeeRecommendations } from "../src/services/recommendation-service.js";
let base: ActiveDataset;
beforeAll(async () => { base = await loadDatasetFromDirectory(fileURLToPath(new URL("../../", import.meta.url))); });

function fixture(current = 4, recurring = false) {
  const source = base.dataset.employees[0];
  const employee = { ...source, last_review_date: "2026-09-01", skills: { ...source.skills, SK_COMMUNICATION: current, SK_SQL: 0 }, career_goal: { target_role: source.role, target_grade: "Lead" as const } };
  const event: Event = { event_id: "CAP_REGRESSION", title: "Cap regression", description: "Fixture", type: "workshop", format: "online", mandatory: false, duration_hours: 1, target_roles: [employee.role], target_grades: [employee.grade], prerequisites: {}, recurring,
    upcoming_sessions: recurring ? ["2026-09-20", "2026-10-01", "2026-10-08"] : ["2026-10-01"],
    develops_skills: [{ skill_id: "SK_COMMUNICATION", gain: 1, max_level: 3 }, { skill_id: "SK_SQL", gain: 1, max_level: 5 }] };
  const active = buildActiveDataset({ ...base.dataset, employees: base.dataset.employees.map((item) => item.employee_id === employee.employee_id ? employee : item), events: [...base.dataset.events, event], activityHistory: base.dataset.activityHistory.filter((item) => item.employee_id !== employee.employee_id) });
  return { active, employee, event, store: new ActiveDatasetStore(active) };
}

describe("non-decreasing skill effects", () => {
  it.each([[4, 1, 3, 4], [3, 1, 3, 3], [2, 1, 3, 3], [4, 3, 5, 5]])("applies level %i + %i with cap %i as %i", (current, gain, cap, result) => {
    expect(applySkillGain(current, gain, cap)).toBe(result);
  });
  it.each([4, 3, 2])("agrees across multi-skill recommendations, completion and reconstruction at level %i", (current) => {
    const { active, employee, event, store } = fixture(current);
    const candidate = evaluateRecommendationCandidate(active, employee, resolveTargetProfile(active, employee), reconstructCurrentSkills(active, employee), event)!;
    expect(candidate.factors.skill_impacts.every((impact) => impact.expected_level >= impact.current_level)).toBe(true);
    const result = completeActivity(store, employee.employee_id, event.event_id);
    expect(result.skill_changes.every((change) => change.gain_applied > 0)).toBe(true);
    const skills = reconstructCurrentSkills(store.get(), employee);
    expect(skills.get("SK_COMMUNICATION")).toBe(current < 3 ? 3 : current);
    expect(skills.get("SK_SQL")).toBe(1);
    for (const impact of candidate.factors.skill_impacts) expect(skills.get(impact.skill_id)).toBe(impact.expected_level);
    for (const change of result.skill_changes) expect(skills.get(change.skill_id)).toBe(change.new_level);
  });
  it("preserves E0003 communication above a lower activity cap", () => {
    const employee = base.indexes.employeesById.get("E0003")!;
    expect(employee.skills.SK_COMMUNICATION).toBe(4);
    expect(reconstructCurrentSkills(base, employee).get("SK_COMMUNICATION")).toBeGreaterThanOrEqual(4);
  });
});

describe("explicit recurring sessions", () => {
  it("awards each listed due occurrence once and blocks future, missing, and unlisted sessions", () => {
    const { employee, event, store } = fixture(4, true);
    const before = store.get();
    for (const session of [undefined, "2026-10-08", "2026-09-19"]) {
      expect(() => completeActivity(store, employee.employee_id, event.event_id, session)).toThrow("Choose a listed session");
      expect(store.get()).toBe(before);
    }
    completeActivity(store, employee.employee_id, event.event_id, "2026-09-20");
    const after = store.get();
    expect(() => completeActivity(store, employee.employee_id, event.event_id, "2026-09-20")).toThrow("already been completed");
    expect(store.get()).toBe(after);
    const second = completeActivity(store, employee.employee_id, event.event_id, "2026-10-01");
    expect(second.skill_changes).toContainEqual({ skill_id: "SK_SQL", previous_level: 1, new_level: 2, gain_applied: 1 });
    const recommendation = getEmployeeRecommendations(store.get(), employee.employee_id).recommendations.find((item) => item.event_id === event.event_id);
    // Inspect the candidate even if other activities rank higher.
    const candidate = evaluateRecommendationCandidate(store.get(), employee, resolveTargetProfile(store.get(), employee), reconstructCurrentSkills(store.get(), employee), event)!;
    expect(candidate.nextSession).toBe("2026-10-08");
    if (recommendation) expect(recommendation.can_complete).toBe(false);
  });
  it("deduplicates an imported occurrence even under different record IDs", () => {
    const { active, employee, event } = fixture(4, true);
    const row: ActivityHistoryRecord = { record_id: "DUP_A", employee_id: employee.employee_id, event_id: event.event_id, date: "2026-09-20", due_date: null, status: "completed", completion_pct: 100, score: null, feedback_rating: null, assigned_by: "self" };
    const updated = buildActiveDataset({ ...active.dataset, activityHistory: [...active.dataset.activityHistory, row, { ...row, record_id: "DUP_B" }] });
    expect(reconstructCurrentSkills(updated, employee).get("SK_SQL")).toBe(1);
    expect(() => completeActivity(new ActiveDatasetStore(updated), employee.employee_id, event.event_id, row.date)).toThrow("already been completed");
  });
  it("reports actual profile deltas when a past session precedes a later capped activity", () => {
    const { active, employee, event } = fixture(4, true);
    const later = { ...event, event_id: "LATER", recurring: false, upcoming_sessions: ["2026-10-01"], develops_skills: [{ skill_id: "SK_SQL", gain: 1, max_level: 5 }] };
    const row: ActivityHistoryRecord = { record_id: "LATER_RECORD", employee_id: employee.employee_id, event_id: later.event_id, date: "2026-09-25", due_date: null, status: "completed", completion_pct: 100, score: null, feedback_rating: null, assigned_by: "self" };
    const capped = { ...event, develops_skills: [{ skill_id: "SK_SQL", gain: 1, max_level: 1 }] };
    const dataset = buildActiveDataset({ ...active.dataset, events: [...active.dataset.events.filter((item) => item.event_id !== event.event_id), capped, later], activityHistory: [...active.dataset.activityHistory, row] });
    // Give the session an additional useful skill so current eligibility is satisfied.
    capped.develops_skills.push({ skill_id: "SK_SYSTEM_DESIGN", gain: 1, max_level: 5 });
    const store = new ActiveDatasetStore(dataset);
    const result = completeActivity(store, employee.employee_id, event.event_id, "2026-09-20");
    const sql = result.profile.skills.find((skill) => skill.skill_id === "SK_SQL")!;
    expect(sql.current_level).toBe(2);
    expect(result.skill_changes).toContainEqual({ skill_id: "SK_SQL", previous_level: 1, new_level: sql.current_level, gain_applied: 1 });
  });

  it("requires explicit recurrence metadata and rejects unsupported self-paced or duplicate sessions", () => {
    const { active, event } = fixture(4, true);
    for (const replacement of [{ ...event, format: "self_paced" as const, upcoming_sessions: [] }, { ...event, upcoming_sessions: ["2026-10-01", "2026-10-01"] }]) {
      expect(() => buildActiveDataset({ ...active.dataset, events: active.dataset.events.map((item) => item.event_id === event.event_id ? replacement : item) })).toThrow();
    }
    expect(() => parseEventsDocument(JSON.stringify({ meta: { dataset: "Career Quest", version: "1.0", as_of_date: "2026-10-01" }, events: [{ ...event, recurring: "yes" }] }))).toThrow();
    const original = base.dataset.events.find((item) => item.event_id === "EV_036")!;
    expect(original.recurring).toBe(true);
  });
});
