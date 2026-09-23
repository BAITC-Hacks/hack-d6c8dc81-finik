import { HttpError } from "../domain/errors.js";
import type { ActiveDataset, ActivityHistoryRecord, Employee, Event, Grade, RoleProfile } from "../domain/types.js";
import { reconstructCurrentSkills, resolveTargetProfile } from "./profile-service.js";

const SCORE_WEIGHTS = {
  effectiveGain: 10,
  criticalEffectiveGain: 5,
  additionalUsefulSkill: 2.5,
  completedSimilar: 1,
  missedOrDeclinedSimilar: 2.5,
  historyCountCap: 3,
} as const;

export interface RecommendationSkillImpact {
  skill_id: string;
  name: string;
  current_level: number;
  required_level: number;
  gain: number;
  max_level: number;
  expected_level: number;
  critical: boolean;
}

export interface RecommendationFactors {
  current_grade: Grade;
  target_grade: Grade;
  skill_impacts: RecommendationSkillImpact[];
  completed_similar: number;
  missed_or_declined_similar: number;
}

export interface RecommendationItem {
  rank: number;
  event_id: string;
  title: string;
  type: Event["type"];
  format: Event["format"];
  duration_hours: number;
  next_session: string | null;
  score: number;
  explanation: string;
  factors: RecommendationFactors;
}

export interface EmployeeRecommendationsResponse {
  employee_id: string;
  target_role: string;
  target_grade: Grade;
  recommendations: RecommendationItem[];
}

interface ScoredCandidate {
  event: Event;
  nextSession: string | null;
  score: number;
  factors: RecommendationFactors;
  effectiveGain: number;
  criticalEffectiveGain: number;
}

function roleProfileKey(role: string, grade: Grade): string {
  return `${role}\u0000${grade}`;
}

function compareSkillImpacts(left: RecommendationSkillImpact, right: RecommendationSkillImpact): number {
  if (left.critical !== right.critical) {
    return left.critical ? -1 : 1;
  }
  if (left.expected_level - left.current_level !== right.expected_level - right.current_level) {
    return (right.expected_level - right.current_level) - (left.expected_level - left.current_level);
  }
  return left.skill_id.localeCompare(right.skill_id);
}

function getNextSession(event: Event, snapshotDate: string): string | null {
  if (event.format === "self_paced") {
    return null;
  }

  return event.upcoming_sessions.filter((session) => session >= snapshotDate).sort()[0] ?? null;
}

function audienceMatches(employee: Employee, event: Event): boolean {
  return event.target_roles.includes(employee.role) && event.target_grades.includes(employee.grade);
}

function prerequisitesAreMet(event: Event, currentSkills: Map<string, number>): boolean {
  return Object.entries(event.prerequisites).every(
    ([skillId, requiredLevel]) => (currentSkills.get(skillId) ?? 0) >= requiredLevel,
  );
}

/**
 * The supplied schema has no recurrence field. The README names a single
 * exception but IDs cannot be hardcoded, so Phase 3 safely treats every
 * completed event as non-repeatable for recommendations. This policy is kept
 * isolated for replacement when a general recurrence signal becomes available.
 */
function canRecommendAfterCompletion(_event: Event): boolean {
  return false;
}

function hasCompletedEvent(activeDataset: ActiveDataset, employeeId: string, eventId: string): boolean {
  return (activeDataset.indexes.historyByEmployeeId.get(employeeId) ?? []).some(
    (record) => record.event_id === eventId && record.status === "completed",
  );
}

function getSimilarHistoryCounts(
  activeDataset: ActiveDataset,
  employeeId: string,
  event: Event,
): Pick<RecommendationFactors, "completed_similar" | "missed_or_declined_similar"> {
  const developedSkills = new Set(event.develops_skills.map((effect) => effect.skill_id));
  let completedSimilar = 0;
  let missedOrDeclinedSimilar = 0;

  for (const record of activeDataset.indexes.historyByEmployeeId.get(employeeId) ?? []) {
    const historicalEvent = activeDataset.indexes.eventsById.get(record.event_id);
    const isSimilar = historicalEvent?.develops_skills.some((effect) => developedSkills.has(effect.skill_id));
    if (!isSimilar) {
      continue;
    }
    if (record.status === "completed") {
      completedSimilar += 1;
    }
    if (record.status === "no_show" || record.status === "declined" || record.status === "dropped") {
      missedOrDeclinedSimilar += 1;
    }
  }

  return { completed_similar: completedSimilar, missed_or_declined_similar: missedOrDeclinedSimilar };
}

function buildSkillImpacts(
  activeDataset: ActiveDataset,
  event: Event,
  targetProfile: RoleProfile,
  currentSkills: Map<string, number>,
): { impacts: RecommendationSkillImpact[]; effectiveGain: number; criticalEffectiveGain: number } {
  const criticalSkills = new Set(targetProfile.critical_skills);
  let effectiveGain = 0;
  let criticalEffectiveGain = 0;
  const impacts = event.develops_skills.flatMap((effect) => {
    const requiredLevel = targetProfile.required_skills[effect.skill_id];
    if (requiredLevel === undefined) {
      return [];
    }

    const currentLevel = currentSkills.get(effect.skill_id) ?? 0;
    const gap = Math.max(0, requiredLevel - currentLevel);
    const expectedLevel = Math.min(5, effect.max_level, currentLevel + effect.gain);
    const usefulGain = Math.min(gap, Math.max(0, expectedLevel - currentLevel));
    if (usefulGain === 0) {
      return [];
    }

    const skill = activeDataset.indexes.skillsById.get(effect.skill_id);
    if (!skill) {
      throw new Error(`Event ${event.event_id} references unknown skill ${effect.skill_id}.`);
    }
    const critical = criticalSkills.has(effect.skill_id);
    effectiveGain += usefulGain;
    if (critical) {
      criticalEffectiveGain += usefulGain;
    }
    return [{
      skill_id: effect.skill_id,
      name: skill.name,
      current_level: currentLevel,
      required_level: requiredLevel,
      gain: effect.gain,
      max_level: effect.max_level,
      expected_level: expectedLevel,
      critical,
    }];
  });

  return { impacts: impacts.sort(compareSkillImpacts), effectiveGain, criticalEffectiveGain };
}

/**
 * Score = 10 × useful target-gap levels
 *       +  5 × useful levels on critical target skills
 *       +2.5 × each additional useful target skill
 *       +  1 × completed similar activities (capped at 3)
 *       −2.5 × missed, declined, or dropped similar activities (capped at 3).
 *
 * The dominant terms are direct, capped progress toward target requirements.
 * History can meaningfully reorder close candidates but cannot outweigh a
 * multi-skill or substantial critical-gap improvement by itself.
 */
export function calculateRecommendationScore({
  effectiveGain,
  criticalEffectiveGain,
  usefulSkillCount,
  completedSimilar,
  missedOrDeclinedSimilar,
}: {
  effectiveGain: number;
  criticalEffectiveGain: number;
  usefulSkillCount: number;
  completedSimilar: number;
  missedOrDeclinedSimilar: number;
}): number {
  const score =
    SCORE_WEIGHTS.effectiveGain * effectiveGain +
    SCORE_WEIGHTS.criticalEffectiveGain * criticalEffectiveGain +
    SCORE_WEIGHTS.additionalUsefulSkill * Math.max(0, usefulSkillCount - 1) +
    SCORE_WEIGHTS.completedSimilar * Math.min(completedSimilar, SCORE_WEIGHTS.historyCountCap) -
    SCORE_WEIGHTS.missedOrDeclinedSimilar * Math.min(missedOrDeclinedSimilar, SCORE_WEIGHTS.historyCountCap);

  return Number(score.toFixed(2));
}

function buildExplanation(candidate: ScoredCandidate): string {
  const primaryImpact = candidate.factors.skill_impacts[0];
  const fragments = [
    `${primaryImpact.name} is ${primaryImpact.current_level}/${primaryImpact.required_level} for ${candidate.factors.target_grade}.`,
    `This activity can raise it to ${primaryImpact.expected_level}.`,
  ];

  if (primaryImpact.critical) {
    fragments.push("It addresses a critical requirement for the target grade.");
  }
  if (candidate.factors.skill_impacts.length > 1) {
    fragments.push(`It also improves ${candidate.factors.skill_impacts.length - 1} other target skill gap${candidate.factors.skill_impacts.length === 2 ? "" : "s"}.`);
  }
  if (candidate.factors.completed_similar > 0 || candidate.factors.missed_or_declined_similar > 0) {
    fragments.push("Your participation in similar activities was considered.");
  }

  return fragments.join(" ");
}

function compareCandidates(left: ScoredCandidate, right: ScoredCandidate): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  const leftSession = left.nextSession ?? "9999-12-31";
  const rightSession = right.nextSession ?? "9999-12-31";
  if (leftSession !== rightSession) {
    return leftSession.localeCompare(rightSession);
  }
  if (left.event.duration_hours !== right.event.duration_hours) {
    return left.event.duration_hours - right.event.duration_hours;
  }
  return left.event.event_id.localeCompare(right.event.event_id);
}

export function evaluateRecommendationCandidate(
  activeDataset: ActiveDataset,
  employee: Employee,
  targetProfile: RoleProfile,
  currentSkills: Map<string, number>,
  event: Event,
): ScoredCandidate | null {
  if (event.mandatory || !audienceMatches(employee, event) || !prerequisitesAreMet(event, currentSkills)) {
    return null;
  }
  const nextSession = getNextSession(event, activeDataset.dataset.snapshotDate);
  if (event.format !== "self_paced" && nextSession === null) {
    return null;
  }
  if (hasCompletedEvent(activeDataset, employee.employee_id, event.event_id) && !canRecommendAfterCompletion(event)) {
    return null;
  }

  const { impacts, effectiveGain, criticalEffectiveGain } = buildSkillImpacts(
    activeDataset,
    event,
    targetProfile,
    currentSkills,
  );
  if (impacts.length === 0) {
    return null;
  }

  const historyCounts = getSimilarHistoryCounts(activeDataset, employee.employee_id, event);
  const factors: RecommendationFactors = {
    current_grade: employee.grade,
    target_grade: targetProfile.grade,
    skill_impacts: impacts,
    ...historyCounts,
  };
  const score = calculateRecommendationScore({
    effectiveGain,
    criticalEffectiveGain,
    usefulSkillCount: impacts.length,
    completedSimilar: historyCounts.completed_similar,
    missedOrDeclinedSimilar: historyCounts.missed_or_declined_similar,
  });

  return { event, nextSession, score, factors, effectiveGain, criticalEffectiveGain };
}

export function getEmployeeRecommendations(
  activeDataset: ActiveDataset,
  employeeId: string,
): EmployeeRecommendationsResponse {
  const employee = activeDataset.indexes.employeesById.get(employeeId);
  if (!employee) {
    throw new HttpError(404, "EMPLOYEE_NOT_FOUND", `Employee ${employeeId} was not found.`);
  }

  const targetProfile = resolveTargetProfile(activeDataset, employee);
  const currentSkills = reconstructCurrentSkills(activeDataset, employee);
  const candidates = activeDataset.dataset.events
    .flatMap((event) => {
      const candidate = evaluateRecommendationCandidate(activeDataset, employee, targetProfile, currentSkills, event);
      return candidate ? [candidate] : [];
    })
    .sort(compareCandidates)
    .slice(0, 3);

  return {
    employee_id: employee.employee_id,
    target_role: targetProfile.role,
    target_grade: targetProfile.grade,
    recommendations: candidates.map((candidate, index) => ({
      rank: index + 1,
      event_id: candidate.event.event_id,
      title: candidate.event.title,
      type: candidate.event.type,
      format: candidate.event.format,
      duration_hours: candidate.event.duration_hours,
      next_session: candidate.nextSession,
      score: candidate.score,
      explanation: buildExplanation(candidate),
      factors: candidate.factors,
    })),
  };
}
