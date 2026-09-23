import { useState } from 'react'
import employeeData from '../../employees.json'
import skillData from '../../skills.json'
import CareerTrajectory from './CareerTrajectory'
import Recommendations from './Recommendations'
import HrDashboard from './HrDashboard'
import './App.css'
import LoginPage from './LoginPage'
import GrowthMilestones from './GrowthMilestones'


const employees = employeeData.employees

const skillNames = Object.fromEntries(
  skillData.skills.map((skill) => [skill.skill_id, skill.name]),
)

function App() {
  const [demoEntered, setDemoEntered] = useState(false)
  const [activeView, setActiveView] = useState('employee')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(
    employees[0]?.employee_id ?? '',
  )
if (!demoEntered) {
  return (
    <LoginPage
      onDemo={(view) => {
        setActiveView(view)
        setDemoEntered(true)
      }}
    />
  )
}
  const employee = employees.find(
    (person) => person.employee_id === selectedId,
  )

  const query = search.trim().toLowerCase()

  const matchingEmployees = employees.filter((person) =>
    `${person.full_name} ${person.employee_id} ${person.role}`
      .toLowerCase()
      .includes(query),
  )

  // Keep the selected employee in the dropdown while searching.
  const selectableEmployees =
    employee &&
    !matchingEmployees.some(
      (person) => person.employee_id === employee.employee_id,
    )
      ? [employee, ...matchingEmployees]
      : matchingEmployees

  if (!employee) {
    return (
      <main className="page">
        <h1>No employee profiles available</h1>
        <p>Check the employees.json file.</p>
      </main>
    )
  }

  const initials = employee.full_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

  const firstName = employee.full_name.split(' ')[0]

  return (
    <div className="cq-app">
      <header className="cq-topbar">
        <a className="cq-brand" href="#main-content">
          <span className="cq-brand-mark" aria-hidden="true">
            CQ
          </span>

          <span>
            Career<span className="cq-brand-accent">Quest</span>
          </span>
        </a>

        <nav className="cq-nav" aria-label="Dashboard views">
          <button
            type="button"
            className={activeView === 'employee' ? 'is-active' : ''}
            aria-pressed={activeView === 'employee'}
            onClick={() => setActiveView('employee')}
          >
            My growth
          </button>

          <button
            type="button"
            className={activeView === 'hr' ? 'is-active' : ''}
            aria-pressed={activeView === 'hr'}
            onClick={() => setActiveView('hr')}
          >
            HR overview
          </button>
        </nav>

        <button
  className="cq-exit-demo"
  type="button"
  onClick={() => setDemoEntered(false)}
         >
  Exit demo
</button>
      </header>

      <main id="main-content" className="cq-workspace">
        {activeView === 'hr' ? (
          <HrDashboard />
        ) : (
          <>
            <section className="cq-welcome">
              <div>
                <p className="eyebrow">YOUR DEVELOPMENT SPACE</p>
                <h1>What’s next for {firstName}?</h1>
                <p>
                  See where you are, explore your next step,
                  and make progress at your own pace.
                </p>
              </div>

              <a className="cq-jump-button" href="#next-steps">
                Explore next steps <span aria-hidden="true">↓</span>
              </a>
            </section>

            <section
              className="cq-person-picker"
              aria-label="Choose an employee profile"
            >
              <div className="cq-picker-field">
                <label htmlFor="employee-search">Find a profile</label>
                <input
                  id="employee-search"
                  type="search"
                  placeholder="Search name, role or employee ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="cq-picker-field">
                <label htmlFor="employee-select">Selected employee</label>
                <select
                  id="employee-select"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {selectableEmployees.map((person) => (
                    <option
                      key={person.employee_id}
                      value={person.employee_id}
                    >
                      {person.full_name} · {person.employee_id}
                    </option>
                  ))}
                </select>
              </div>

              <p className="cq-search-status" role="status">
                {query
                  ? `${matchingEmployees.length} matching profiles.`
                  : `${employees.length} synthetic employee profiles.`}
                {query && matchingEmployees.length === 0
                  ? ' Your current selection is unchanged.'
                  : ''}
              </p>
            </section>

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
                      <dd>{employee.department}</dd>
                    </div>

                    <div>
                      <dt>Time at company</dt>
                      <dd>{employee.tenure_months} months</dd>
                    </div>

                    <div>
                      <dt>Work format</dt>
                      <dd>{employee.work_format}</dd>
                    </div>
                  </dl>

                  <div className="cq-goal">
                    <span className="cq-goal-label">CAREER GOAL</span>
                    <strong>
                      {employee.career_goal
                        ? employee.career_goal.target_grade
                        : 'Not set yet'}
                    </strong>
                    {employee.career_goal && (
                      <span>{employee.career_goal.target_role}</span>
                    )}
                  </div>
                </section>

                <details
                  className="card cq-assessment"
                  key={employee.employee_id}
                >
                  <summary className="skills-summary">
                    Assessed skills
                    <span className="skills-count">
                      {Object.keys(employee.skills).length}
                    </span>
                  </summary>

                  <p className="assessment-note">
                    Assessment: {employee.last_review_date}.
                    Later activity gains are not included yet.
                  </p>

                  <div className="skills-list">
                    {Object.entries(employee.skills).map(
                      ([skillId, level]) => (
                        <div className="skill" key={skillId}>
                          <div className="skill-heading">
                            <label htmlFor={`assessed-${skillId}`}>
                              {skillNames[skillId] ?? skillId}
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
                />
                <div id="next-steps" className="cq-anchor">
                  <Recommendations />
                </div>

                <CareerTrajectory employee={employee} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App