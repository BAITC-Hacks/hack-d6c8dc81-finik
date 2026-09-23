const sampleRecommendations = [
  {
    rank: 1,
    event_id: 'PREVIEW_001',
    title: 'System Design Workshop',
    format: 'online',
    duration_hours: 3,
    explanation:
      'System Design is critical for the target Senior grade. This activity addresses a two-level gap. Previous participation suggests that a practical workshop could be a suitable next step.',
    factors: {
      current_grade: 'Middle',
      target_grade: 'Senior',
      completed_similar: 2,
      missed_or_declined_similar: 1,
      skill_impacts: [
        {
          skill_id: 'SK_SYSTEM_DESIGN',
          name: 'System Design',
          current_level: 2,
          required_level: 4,
          expected_level: 3,
          critical: true,
        },
      ],
    },
  },
  {
    rank: 2,
    event_id: 'PREVIEW_002',
    title: 'Advanced Python Practice',
    format: 'self_paced',
    duration_hours: 5,
    explanation:
      'Python needs one additional level for the target Senior grade. Previous completion of similar learning activities supports this choice.',
    factors: {
      current_grade: 'Middle',
      target_grade: 'Senior',
      completed_similar: 1,
      missed_or_declined_similar: 0,
      skill_impacts: [
        {
          skill_id: 'SK_PYTHON',
          name: 'Python',
          current_level: 3,
          required_level: 4,
          expected_level: 4,
          critical: false,
        },
      ],
    },
  },
]

const formatLabels = {
  online: 'Online',
  offline: 'In person',
  self_paced: 'Self-paced',
}

function Recommendations({
  recommendations = sampleRecommendations,
  preview = true,
  loading = false,
  error = '',
  completingEventId = null,
  onComplete,
}) {
  return (
    <section className="card recommendations-section">
      <div className="recommendations-heading">
        <div>
          <p className="eyebrow">YOUR NEXT STEPS</p>
          <h2>Recommended activities</h2>
        </div>

        {preview && <span className="preview-badge">Layout preview</span>}
      </div>

      {preview && (
        <p className="assessment-note">
          These are fictional examples for a Middle Backend Engineer.
          They are not recommendations for the selected employee.
        </p>
      )}

      {loading ? (
        <p role="status">Finding your next steps…</p>
      ) : error ? (
        <p className="recommendation-error" role="alert">
          {error}
        </p>
      ) : recommendations.length === 0 ? (
        <p className="assessment-note">
          No suitable activities are currently available for this employee.
        </p>
      ) : (
        <div className="recommendation-grid">
          {recommendations.map((recommendation) => (
            <article
              className="recommendation-card"
              key={recommendation.event_id}
            >
              <span className="recommendation-rank">
                Suggested step {recommendation.rank}
              </span>

              <h3>{recommendation.title}</h3>

              <p className="activity-meta">
                {formatLabels[recommendation.format] ??
                  recommendation.format}
                {' · '}
                {recommendation.duration_hours} hours
              </p>

              <p className="recommendation-explanation">
                {recommendation.explanation}
              </p>

              <div className="recommendation-impacts">
                {recommendation.factors.skill_impacts.map((skill) => (
                  <div className="impact-row" key={skill.skill_id}>
                    <div>
                      <strong>{skill.name}</strong>
                      <span>Target level: {skill.required_level}</span>
                    </div>

                    <span className="impact-change">
                      {skill.current_level} → {skill.expected_level}
                    </span>
                  </div>
                ))}
              </div>

              <div className="recommendation-evidence">
                <span>
                  {recommendation.factors.current_grade}
                  {' → '}
                  {recommendation.factors.target_grade}
                </span>
                <span>
                  {recommendation.factors.completed_similar} similar
                  activities completed
                </span>
                <span>
                  {recommendation.factors.missed_or_declined_similar}{' '}
                  missed or declined
                </span>
              </div>

              <button
                className="complete-button"
                type="button"
                disabled={
                  preview ||
                  !onComplete ||
                  completingEventId !== null
                }
                onClick={() => onComplete?.(recommendation.event_id)}
              >
                {completingEventId === recommendation.event_id
                  ? 'Saving…'
                  : 'Mark completed'}
              </button>

              {preview && (
                <p className="button-note">
                  Available after the backend is connected.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default Recommendations