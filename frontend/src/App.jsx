import { useRef, useState } from 'react'
import { api } from './api'
import { useApiResource } from './useApiResource'
import ApiState from './ApiState'
import EmployeeDashboard from './EmployeeDashboard'
import HrDashboard from './HrDashboard'
import DataImport from './DataImport'
import LoginPage from './LoginPage'
import './App.css'

const loadEmployees = (_key, signal) => api.employees(signal)

function App() {
  const [demoEntered, setDemoEntered] = useState(false)
  const [activeView, setActiveView] = useState('employee')
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState('')
  const [revision, setRevision] = useState(0)
  const [hrRevision, setHrRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const mutation = useRef(false)
  const list = useApiResource(loadEmployees, demoEntered ? 'employees' : null)
  const employees = list.data?.employees ?? []
  const employee = employees.find((person) => person.employee_id === selection) ?? employees[0]
  const selectedId = employee?.employee_id ?? ''
  const query = search.trim().toLowerCase()
  const matchingEmployees = employees.filter((person) =>
    `${person.full_name} ${person.employee_id} ${person.role}`.toLowerCase().includes(query),
  )
  const selectableEmployees = employee && !matchingEmployees.includes(employee)
    ? [employee, ...matchingEmployees] : matchingEmployees

  async function complete(employeeId, eventId) {
    if (mutation.current) throw new Error('Another update is in progress. Please wait.')
    mutation.current = true
    setBusy(true)
    try {
      const result = await api.complete(employeeId, eventId)
      setHrRevision((value) => value + 1)
      return result
    } finally {
      mutation.current = false
      setBusy(false)
    }
  }

  async function importFiles(files) {
    if (mutation.current) throw new Error('Another update is in progress. Please wait.')
    mutation.current = true
    setBusy(true)
    try {
      const result = await api.importFiles(files)
      // Keep the selected ID while the list refreshes; fall back only if it disappeared.
      setSelection(selectedId)
      list.retry()
      setRevision((value) => value + 1)
      setHrRevision((value) => value + 1)
      return result
    } finally {
      mutation.current = false
      setBusy(false)
    }
  }

  if (!demoEntered) return <LoginPage onDemo={(view) => {
    setActiveView(view)
    setDemoEntered(true)
  }} />

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
            disabled={busy}
            onClick={() => setActiveView('employee')}
          >
            My growth
          </button>

          <button
            type="button"
            className={activeView === 'hr' ? 'is-active' : ''}
            aria-pressed={activeView === 'hr'}
            disabled={busy}
            onClick={() => setActiveView('hr')}
          >
            HR overview
          </button>
        </nav>

        <button
          className="cq-exit-demo"
          type="button"
          disabled={busy}
          onClick={() => setDemoEntered(false)}
        >
          Exit demo
        </button>
      </header>

      <main id="main-content" className="cq-workspace">
        {activeView === 'hr' ? (
          <div className="hr-dashboard">
            <DataImport onImport={importFiles} busy={busy} />
            <HrDashboard key={hrRevision} />
          </div>
        ) : (
          <>
            <section className="cq-welcome">
              <div>
                <p className="eyebrow">YOUR DEVELOPMENT SPACE</p>
                <h1>{employee ? `What’s next for ${employee.full_name.split(' ')[0]}?` : 'Your next chapter'}</h1>
                <p>See where you are, explore your next step, and make progress at your own pace.</p>
              </div>
              <a className="cq-jump-button" href="#next-steps">Explore next steps ↓</a>
            </section>
            {!list.data ? <ApiState resource={list} label="employee list" /> : employees.length === 0 ? (
              <section className="card"><h2>No employee profiles available</h2><p>Open HR overview to import employee data.</p></section>
            ) : (
              <>
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
                      disabled={busy}
                      value={selectedId}
                      onChange={(event) => setSelection(event.target.value)}
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

                <EmployeeDashboard key={`${selectedId}:${revision}`} employeeId={selectedId}
                  department={employee.department} onComplete={complete} busy={busy} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
