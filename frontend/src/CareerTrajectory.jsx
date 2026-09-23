import skillData from '../../skills.json'

const grades = ['Junior', 'Middle', 'Senior', 'Lead']

const skillNames = Object.fromEntries(
  skillData.skills.map((skill) => [skill.skill_id, skill.name]),
)

function CareerTrajectory({ employee }) {
  const currentGradeIndex = grades.indexOf(employee.grade)

  const nextGrade =
    currentGradeIndex >= 0
      ? grades[currentGradeIndex + 1]
      : undefined

  const targetRole = employee.career_goal?.target_role ?? employee.role
  const targetGrade = employee.career_goal?.target_grade ?? nextGrade

  const targetProfile = skillData.role_profiles.find(
    (profile) =>
      profile.role === targetRole && profile.grade === targetGrade,
  )

  if (!targetProfile) {
    return (
      <section className="card trajectory-card">
        <h2>Career trajectory</h2>
        <p className="assessment-note">
          {targetGrade
            ? 'Requirements for this career goal are not available.'
            : 'No further grade is defined. A new career goal can be discussed with your manager.'}
        </p>
      </section>
    )
  }

  const requiredSkills = Object.entries(targetProfile.required_skills)
    .map(([skillId, requiredLevel]) => {
      const currentLevel = employee.skills[skillId] ?? 0

      return {
        skillId,
        name: skillNames[skillId] ?? skillId,
        currentLevel,
        requiredLevel,
        gap: Math.max(0, requiredLevel - currentLevel),
        critical: targetProfile.critical_skills.includes(skillId),
      }
    })
    .sort(
      (a, b) =>
        Number(b.critical) - Number(a.critical) ||
        b.gap - a.gap ||
        a.name.localeCompare(b.name),
    )

  const metCount = requiredSkills.filter((skill) => skill.gap === 0).length

  return (
    <section className="card trajectory-card">
      <p className="eyebrow">YOUR NEXT LEVEL</p>
      <h2>Career trajectory</h2>

      <div className="career-route">
        <div>
          <span className="route-label">Current</span>
          <strong>{employee.grade}</strong>
          <span>{employee.role}</span>
        </div>

        <span className="route-arrow" aria-hidden="true">→</span>

        <div>
          <span className="route-label">Target</span>
          <strong>{targetGrade}</strong>
          <span>{targetRole}</span>
        </div>
      </div>

      <p className="readiness-summary">
        <strong>{metCount} of {requiredSkills.length}</strong> skill
        requirements met
      </p>

      <p className="assessment-note">
        Based on the assessment dated {employee.last_review_date}.
        Meeting skill requirements does not automatically grant promotion.
      </p>

      <div className="skills-list">
        {requiredSkills.map((skill) => (
          <div className="skill" key={skill.skillId}>
            <div className="skill-heading">
              <label htmlFor={`target-${skill.skillId}`}>
                {skill.name}
              </label>
              <strong>
                {skill.currentLevel} / {skill.requiredLevel}
              </strong>
            </div>

            <progress
              id={`target-${skill.skillId}`}
              value={Math.min(skill.currentLevel, skill.requiredLevel)}
              max={Math.max(1, skill.requiredLevel)}
            />

            <div className="skill-tags">
              {skill.critical && (
                <span className="critical-tag">
                  Critical for promotion
                </span>
              )}

              <span className={skill.gap === 0 ? 'met-tag' : 'gap-tag'}>
                {skill.gap === 0
                  ? 'Requirement met'
                  : `${skill.gap} level${skill.gap === 1 ? '' : 's'} to develop`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default CareerTrajectory