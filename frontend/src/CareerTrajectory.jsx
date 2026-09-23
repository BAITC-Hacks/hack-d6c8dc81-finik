import TargetSkill from './TargetSkill'

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
        Skills use a 0–5 proficiency scale; each role and grade can require a different target level.
        Includes completed activity gains.
        Meeting skill requirements does not automatically grant promotion.
      </p>

      <div className="skills-list">
        {requiredSkills.map((skill) => (
          <TargetSkill key={skill.skill_id} skill={skill} idPrefix="target" />
        ))}
      </div>
    </section>
  )
}

export default CareerTrajectory