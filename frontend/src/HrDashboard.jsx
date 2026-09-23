import { api } from './api'
import { useApiResource } from './useApiResource'
import ApiState from './ApiState'

const loadOverview = (_key, signal) => api.overview(signal)

function HrDashboard() {
  const resource = useApiResource(loadOverview, 'overview')
  if (!resource.data) return <ApiState resource={resource} label="HR overview" />
  const overview = resource.data
  return (
    <div className="hr-dashboard">

      <section className="card">
        <div className="recommendations-heading">
          <div>
            <p className="eyebrow">TEAM DEVELOPMENT</p>
            <h2>HR overview</h2>
          </div>

        </div>
      </section>

      <div className="hr-stats">
        <section className="card hr-stat">
          <h3>Employees</h3>
          <strong>{overview.employee_count}</strong>
        </section>

        <section className="card hr-stat">
          <h3>Completed activities</h3>
          <strong>{overview.completed_activity_count}</strong>
        </section>

        <section className="card hr-stat">
          <h3>Without a recommended step</h3>
          <strong>{overview.employees_without_step.length}</strong>
        </section>
      </div>

      <section className="card">
        <h2>Most common skill gaps</h2>
        <p className="assessment-note">
          Employees below the skill level required for their target grade.
        </p>

        {overview.top_skill_gaps.length === 0 ? (
          <p>No skill gaps to display.</p>
        ) : (
          <div className="skills-list">
            {overview.top_skill_gaps.map((skill) => (
              <div className="skill" key={skill.skill_id}>
                <div className="skill-heading">
                  <label htmlFor={`hr-gap-${skill.skill_id}`}>
                    {skill.name}
                  </label>
                  <strong>{skill.employee_count} employees</strong>
                </div>

                <progress
                  id={`hr-gap-${skill.skill_id}`}
                  value={skill.employee_count}
                  max={Math.max(overview.employee_count, 1)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Activity participation</h2>

        {overview.participation_by_event.length === 0 ? (
          <p>No participation records to display.</p>
        ) : (
          <div
            className="hr-table-wrapper"
            role="region"
            aria-label="Activity participation"
            tabIndex={0}
          >
            <table className="hr-table">
              <thead>
                <tr>
                  <th scope="col">Activity</th>
                  <th scope="col">Completed</th>
                  <th scope="col">No-show</th>
                  <th scope="col">Dropped</th>
                </tr>
              </thead>
              <tbody>
                {overview.participation_by_event.map((event) => (
                  <tr key={event.event_id}>
                    <th scope="row">{event.title}</th>
                    <td>{event.completed}</td>
                    <td>{event.no_show}</td>
                    <td>{event.dropped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Employees without a recommended step</h2>
        <p className="assessment-note">
          Review their goals and the available activity catalog.
          A missing recommendation does not indicate poor performance.
        </p>

        {overview.employees_without_step.length === 0 ? (
          <p>Every employee has an available recommended step.</p>
        ) : (
          <div
            className="hr-table-wrapper"
            role="region"
            aria-label="Employees without a recommended step"
            tabIndex={0}
          >
            <table className="hr-table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Role</th>
                  <th scope="col">Grade</th>
                </tr>
              </thead>
              <tbody>
                {overview.employees_without_step.map((employee) => (
                  <tr key={employee.employee_id}>
                    <th scope="row">{employee.full_name}</th>
                    <td>{employee.role}</td>
                    <td>{employee.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default HrDashboard