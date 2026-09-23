import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useApiResource } from './useApiResource'
import ApiState from './ApiState'
import CareerTrajectory from './CareerTrajectory'
import GrowthMilestones from './GrowthMilestones'
import Recommendations from './Recommendations'

const loadEmployee = async (id, signal) => {
  const [profile, result] = await Promise.all([
    api.employee(id, signal), api.recommendations(id, signal),
  ])
  return { profile, recommendations: result.recommendations }
}

export default function EmployeeDashboard({ employeeId, department, onComplete, busy }) {
  const resource = useApiResource(loadEmployee, employeeId)
  const [completingEventId, setCompletingEventId] = useState(null)
  const [completionError, setCompletionError] = useState('')
  const [celebration, setCelebration] = useState(0)
  const mounted = useRef(false)
  const submitting = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function complete(eventId) {
    if (submitting.current || busy) return
    submitting.current = true
    setCompletingEventId(eventId)
    setCompletionError('')
    try {
      const response = await onComplete(employeeId, eventId)
      if (!mounted.current) return
      resource.replace({ profile: response.profile, recommendations: response.recommendations })
      setCelebration((value) => value + 1)
    } catch (error) {
      if (mounted.current) setCompletionError(error.message)
    } finally {
      submitting.current = false
      if (mounted.current) setCompletingEventId(null)
    }
  }

  if (!resource.data) return <ApiState resource={resource} label="employee profile and recommendations" />
  const { profile: employee, recommendations } = resource.data
  const initials = employee.full_name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('')
  return (
    <div className="cq-dashboard">
      <aside className="cq-profile-column">
        <section className="cq-profile">
          <div className="cq-avatar" aria-hidden="true">
            {initials}
          </div>

          <h2>{employee.full_name}</h2>
          <p className="cq-profile-role">{employee.role}</p>
          <span className="cq-grade">{employee.grade}</span>

          <dl className="cq-profile-facts">
            <div>
              <dt>Department</dt>
              <dd>{department}</dd>
            </div>

            <div>
              <dt>Time at company</dt>
              <dd>{employee.tenure_months} months</dd>
            </div>


          </dl>

          <div className="cq-goal">
            <span className="cq-goal-label">CAREER GOAL</span>
            <strong>
              {employee.target_grade}
            </strong>
            <span>{employee.target_role}</span>
          </div>
        </section>

        <details
          className="card cq-assessment"
          key={employee.employee_id}
        >
          <summary className="skills-summary">
            Current target skills
            <span className="skills-count">
              {employee.skills.length}
            </span>
          </summary>

          <p className="assessment-note">
            Includes completed activity gains calculated by the backend.
          </p>

          <div className="skills-list">
            {employee.skills.map(
              ({ skill_id: skillId, name, current_level: level }) => (
                <div className="skill" key={skillId}>
                  <div className="skill-heading">
                    <label htmlFor={`assessed-${skillId}`}>
                      {name}
                    </label>
                    <strong>{level} / 5</strong>
                  </div>

                  <progress
                    id={`assessed-${skillId}`}
                    value={level}
                    max="5"
                  />
                </div>
              ),
            )}
          </div>
        </details>
      </aside>

      <div className="cq-main-column">
        <GrowthMilestones
          key={employee.employee_id}
          employee={employee}
          celebration={celebration}
        />
        <div id="next-steps" className="cq-anchor">
          <Recommendations recommendations={recommendations}
            completingEventId={completingEventId ?? (busy ? 'pending' : null)} onComplete={complete}
            completionError={completionError} />
        </div>

        <CareerTrajectory employee={employee} />
        <section className="card">
          <h2>Development history</h2>
          {employee.history.length === 0 ? <p>No activity history yet.</p> : (
            <ul>{employee.history.map((item) => (
              <li key={item.record_id}>{item.event_title} · {item.date} · {item.status.replaceAll('_', ' ')}</li>
            ))}</ul>
          )}
        </section>
      </div>
    </div>
  )
}
