import { useState } from 'react'
import skillData from '../../skills.json'

const grades = ['Junior', 'Middle', 'Senior', 'Lead']

function GrowthMilestones({ employee }) {
  const [celebration, setCelebration] = useState(0)

  const gradeIndex = grades.indexOf(employee.grade)
  const nextGrade =
    gradeIndex >= 0 ? grades[gradeIndex + 1] : undefined

  const targetRole = employee.career_goal?.target_role ?? employee.role
  const targetGrade = employee.career_goal?.target_grade ?? nextGrade

  const targetProfile = skillData.role_profiles.find(
    (profile) =>
      profile.role === targetRole && profile.grade === targetGrade,
  )

  if (!targetProfile) return null

  const requirements = Object.entries(targetProfile.required_skills)

  if (requirements.length === 0) return null

  const completedRequirements = requirements.filter(
    ([skillId, requiredLevel]) =>
      (employee.skills[skillId] ?? 0) >= requiredLevel,
  ).length

  const percentage = Math.round(
    (completedRequirements / requirements.length) * 100,
  )

  const criticalSkills = targetProfile.critical_skills ?? []

  const completedCritical = criticalSkills.filter(
    (skillId) =>
      (employee.skills[skillId] ?? 0) >=
      targetProfile.required_skills[skillId],
  ).length

  const milestones = [
    {
      id: 'first',
      title: 'A strong starting point',
      description: 'Meet at least one target skill requirement.',
      achieved: completedRequirements >= 1,
    },
    {
      id: 'halfway',
      title: 'Halfway there',
      description: 'Meet at least half of the target requirements.',
      achieved:
        completedRequirements >= Math.ceil(requirements.length / 2),
    },
    ...(criticalSkills.length > 0
      ? [
          {
            id: 'critical',
            title: 'Core skills covered',
            description: 'Meet every critical skill requirement.',
            achieved: completedCritical === criticalSkills.length,
          },
        ]
      : []),
    {
      id: 'all',
      title: 'Skill targets reached',
      description: 'Meet all skills listed for your target grade.',
      achieved: completedRequirements === requirements.length,
    },
  ]

  return (
    <section className="card growth-panel">
      <div className="growth-heading">
        <div>
          <p className="eyebrow">YOUR PERSONAL JOURNEY</p>
          <h2>Small steps. Visible progress.</h2>
        </div>

        <span className="growth-target">{targetGrade}</span>
      </div>

      <div className="growth-overview">
        <div
          className="growth-ring"
          style={{ '--growth-angle': `${percentage * 3.6}deg` }}
          role="img"
          aria-label={`${completedRequirements} of ${requirements.length} target skill requirements met`}
        >
          <div className="growth-ring-inner">
            <strong>{percentage}%</strong>
            <span>skills met</span>
          </div>
        </div>

        <div className="growth-summary">
          <h3>
            {completedRequirements} of {requirements.length} requirements met
          </h3>

          <p>
            Your next target is {targetGrade} {targetRole}.
            Each relevant activity can help close a skill gap.
          </p>

          {criticalSkills.length > 0 && (
            <span className="growth-critical">
              {completedCritical} / {criticalSkills.length} critical
              requirements met
            </span>
          )}
        </div>
      </div>

      <ul className="growth-milestones">
        {milestones.map((milestone) => (
          <li
            key={milestone.id}
            className={
              milestone.achieved
                ? 'growth-milestone achieved'
                : 'growth-milestone'
            }
          >
            <span className="growth-symbol" aria-hidden="true">
              {milestone.achieved ? '✓' : '○'}
            </span>

            <div>
              <strong>{milestone.title}</strong>
              <p>{milestone.description}</p>
              <span className="growth-status">
                {milestone.achieved ? 'Reached' : 'Ahead of you'}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="growth-footnote">
        Based on the assessment dated {employee.last_review_date}.
        These milestones describe your current skills; they do not
        automatically grant a promotion.
      </p>

      <details className="growth-preview">
        <summary>Preview the completion animation</summary>

        <p>
          Interface demonstration only. This does not complete an activity
          or change employee data.
        </p>

        <button
          className="growth-preview-button"
          type="button"
          onClick={() => setCelebration((value) => value + 1)}
        >
          Play celebration
        </button>

        {celebration > 0 && (
          <div
            className="growth-celebration"
            key={celebration}
            role="status"
          >
            <span className="growth-celebration-icon" aria-hidden="true">
              ✓
            </span>

            <div>
              <strong>A step worth celebrating!</strong>
              <p>Animation preview — your progress is unchanged.</p>
            </div>
          </div>
        )}
      </details>
    </section>
  )
}

export default GrowthMilestones