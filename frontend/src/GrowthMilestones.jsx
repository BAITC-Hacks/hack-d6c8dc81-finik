function GrowthMilestones({ employee, celebration = 0 }) {
  const { target_role: targetRole, target_grade: targetGrade, readiness } = employee
  const { requirements_met: completedRequirements, requirements_total: total,
    critical_requirements_met: completedCritical, critical_requirements_total: criticalTotal } = readiness
  if (total === 0) return null
  // Visual formatting of server readiness counts, not a separate readiness model.
  const percentage = Math.round(completedRequirements / total * 100)
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
        completedRequirements >= Math.ceil(total / 2),
    },
    ...(criticalTotal > 0
      ? [
          {
            id: 'critical',
            title: 'Core skills covered',
            description: 'Meet every critical skill requirement.',
            achieved: completedCritical === criticalTotal,
          },
        ]
      : []),
    {
      id: 'all',
      title: 'Skill targets reached',
      description: 'Meet all skills listed for your target grade.',
      achieved: completedRequirements === total,
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
          aria-label={`${completedRequirements} of ${total} target skill requirements met`}
        >
          <div className="growth-ring-inner">
            <strong>{percentage}%</strong>
            <span>skills met</span>
          </div>
        </div>

        <div className="growth-summary">
          <h3>
            {completedRequirements} of {total} requirements met
          </h3>

          <p>
            Your next target is {targetGrade} {targetRole}.
            Each relevant activity can help close a skill gap.
          </p>

          {criticalTotal > 0 && (
            <span className="growth-critical">
              {completedCritical} / {criticalTotal} critical
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
        Based on current backend progress, including completed activities.
        These milestones describe your current skills; they do not
        automatically grant a promotion.
      </p>

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
            <p>Activity completed. Your progress has been updated.</p>
          </div>
        </div>
      )}

    </section>
  )
}

export default GrowthMilestones