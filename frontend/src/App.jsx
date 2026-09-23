import { useState } from 'react'
import employeeData from '../../employees.json'
import skillData from '../../skills.json'
import './App.css'

const employees = employeeData.employees

const skillNames = Object.fromEntries(
  skillData.skills.map((skill) => [skill.skill_id, skill.name]),
)

function App() {
  const [selectedId, setSelectedId] = useState(
    employees[0]?.employee_id ?? '',
  )

  const employee = employees.find(
    (person) => person.employee_id === selectedId,
  )

  if (!employee) {
    return (
      <main className="page">
        <h1>No employees found</h1>
        <p>Check that employees.json contains employee profiles.</p>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">CAREER QUEST</p>
          <h1>Your growth, one step at a time.</h1>
          <p className="subtitle">
            Explore your profile and current skills.
          </p>
        </div>

        <span className="dataset-label">Synthetic demo data</span>
      </header>

      <section className="card employee-picker">
        <label htmlFor="employee">Choose an employee</label>

        <select
          id="employee"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {employees.map((person) => (
            <option
              key={person.employee_id}
              value={person.employee_id}
            >
              {person.full_name} · {person.employee_id}
            </option>
          ))}
        </select>
      </section>

      <div className="profile-layout">
        <section className="card profile-card">
          <p className="eyebrow">EMPLOYEE PROFILE</p>
          <h2>{employee.full_name}</h2>
          <p className="role">{employee.role}</p>

          <span className="grade-badge">{employee.grade}</span>

          <dl className="profile-details">
            <div>
              <dt>Department</dt>
              <dd>{employee.department}</dd>
            </div>

            <div>
              <dt>Time at the company</dt>
              <dd>{employee.tenure_months} months</dd>
            </div>

            <div>
              <dt>Work format</dt>
              <dd>{employee.work_format}</dd>
            </div>

            <div>
              <dt>Career goal</dt>
              <dd>
                {employee.career_goal
                  ? `${employee.career_goal.target_grade} ${employee.career_goal.target_role}`
                  : 'Not set yet'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card skills-card">
          <div className="section-heading">
            <h2>Assessed skills</h2>
            <span>Level 0–5</span>
          </div>

          <p className="assessment-note">
            Recorded at the last assessment: {employee.last_review_date}.
            Later activity gains are not included in this screen yet.
          </p>

          <div className="skills-list">
            {Object.entries(employee.skills).map(([skillId, level]) => (
              <div className="skill" key={skillId}>
                <div className="skill-heading">
                  <label htmlFor={`skill-${skillId}`}>
                    {skillNames[skillId] ?? skillId}
                  </label>
                  <strong>{level} / 5</strong>
                </div>

                <progress
                  id={`skill-${skillId}`}
                  value={level}
                  max="5"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default App