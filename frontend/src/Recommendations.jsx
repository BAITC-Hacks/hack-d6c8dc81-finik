const formatLabels = {
  online: 'Online',
  offline: 'In person',
  self_paced: 'Self-paced',
}

function Recommendations({
  recommendations = [],
  completionError = '',
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

      </div>
      {completionError && <p className="recommendation-error" role="alert">{completionError} You can retry Mark completed.</p>}

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
                {recommendation.next_session && ` · Next session: ${recommendation.next_session}`}
              </p>

              <span className="assessment-note">
                {recommendation.explanation_source === 'ai' ? 'AI-assisted explanation · verified facts' : 'Rule-based explanation'}
              </span>
              <p className="recommendation-explanation">
                {recommendation.explanation}
              </p>

              <div className="recommendation-impacts">
                {recommendation.factors.skill_impacts.map((skill) => (
                  <div className="impact-row" key={skill.skill_id}>
                    <div>
                      <strong>{skill.name}</strong>
                      <span>Role target level: {skill.required_level}</span>
                      <span>Gain: {skill.gain} · Activity can develop this skill up to level {skill.max_level}</span>
                      {skill.critical && <span className="critical-tag">Critical for promotion</span>}
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
                  !onComplete || recommendation.can_complete === false ||
                  completingEventId !== null
                }
                onClick={() => onComplete?.(recommendation.event_id, recommendation.recurring ? recommendation.next_session : undefined)}
              >
                {completingEventId === recommendation.event_id
                  ? 'Saving…'
                  : recommendation.can_complete === false ? 'Session not yet completable' : 'Mark completed'}
              </button>

            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default Recommendations