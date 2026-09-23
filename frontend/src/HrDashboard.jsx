import DataImport from './DataImport'
const sampleOverview = {
  employee_count: 200,
  completed_activity_count: 900,
  top_skill_gaps: [
    {
      skill_id: 'SK_SYSTEM_DESIGN',
      name: 'System Design',
      employee_count: 32,
    },
    {
      skill_id: 'SK_PUBLIC_SPEAKING',
      name: 'Public Speaking',
      employee_count: 25,
    },
    {
      skill_id: 'SK_PYTHON',
      name: 'Python',
      employee_count: 18,
    },
  ],
  participation_by_event: [
    {
      event_id: 'PREVIEW_001',
      title: 'System Design Workshop',
      completed: 18,
      no_show: 3,
      dropped: 2,
    },
    {
      event_id: 'PREVIEW_002',
      title: 'Advanced Python Practice',
      completed: 24,
      no_show: 0,
      dropped: 4,
    },
  ],
  employees_without_step: [
    {
      employee_id: 'PREVIEW_EMPLOYEE',
      full_name: 'Example Employee',
      role: 'Backend Engineer',
      grade: 'Lead',
    },
  ],
}

function HrDashboard({
  overview = sampleOverview,
  preview = true,
  loading = false,
  error = '',
}) {
  if (loading) {
    return <p role="status">Loading the HR overview…</p>
  }

  if (error) {
    return (
      <p className="recommendation-error" role="alert">
        {error}
      </p>
    )
  }

  if (!overview) {
    return <p>No HR data is available yet.</p>
  }

  return (
    <div className="hr-dashboard">
    <DataImport />
      <section className="card">
        <div className="recommendations-heading">
          <div>
            <p className="eyebrow">TEAM DEVELOPMENT</p>
            <h2>HR overview</h2>
          </div>

          {preview && (
            <span className="preview-badge">Layout preview</span>
          )}
        </div>

        {preview && (
          <p className="assessment-note">
            These figures are examples. Live statistics will come from
            the backend.
          </p>
        )}
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