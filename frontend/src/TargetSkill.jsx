export default function TargetSkill({ skill, idPrefix }) {
  const { skill_id: id, name, current_level: current, required_level: target, gap, critical } = skill
  // Only the visual fill is capped; the backend's actual levels remain visible.
  const progress = target === 0 ? 1 : Math.min(1, current / target)
  const status = current > target ? 'Target exceeded' : current === target
    ? 'Target met' : `${gap} level${gap === 1 ? '' : 's'} remaining`

  return (
    <div className="skill target-skill">
      <div className="skill-heading">
        <label htmlFor={`${idPrefix}-${id}`}>{name}</label>
        <strong>{current}/{target}</strong>
      </div>
      <progress id={`${idPrefix}-${id}`} value={progress} max="1" />
      <div className="skill-tags">
        {critical && <span className="critical-tag">Critical for promotion</span>}
        <span className={gap === 0 ? 'met-tag' : 'gap-tag'}>{status}</span>
      </div>
    </div>
  )
}
