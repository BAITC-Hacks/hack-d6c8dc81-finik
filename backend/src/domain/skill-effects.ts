/** A development activity can raise a valid skill level, never lower it. */
export function applySkillGain(current: number, gain: number, maxLevel: number): number {
  return Math.max(current, Math.min(5, maxLevel, current + gain));
}
