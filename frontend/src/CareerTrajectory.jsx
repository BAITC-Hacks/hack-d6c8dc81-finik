function CareerTrajectory({ employee }) {
  const { target_role: targetRole, target_grade: targetGrade, skills: requiredSkills, readiness } = employee
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
        <strong>{readiness.requirements_met} of {readiness.requirements_total}</strong> skill
        requirements met
      </p>

      <p className="assessment-note">
        Includes completed activity gains.
        Meeting skill requirements does not automatically grant promotion.
      </p>

      <div className="skills-list">
        {requiredSkills.map((skill) => (
          <div className="skill" key={skill.skill_id}>
            <div className="skill-heading">
              <label htmlFor={`target-${skill.skill_id}`}>
                {skill.name}
              </label>
              <strong>
                {skill.current_level} / {skill.required_level}
              </strong>
            </div>

            <progress
              id={`target-${skill.skill_id}`}
              value={Math.min(skill.current_level, skill.required_level)}
              max={Math.max(1, skill.required_level)}
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