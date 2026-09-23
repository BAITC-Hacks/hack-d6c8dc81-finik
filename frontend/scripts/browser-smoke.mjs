// Dependency-free browser smoke test. Requires Google Chrome and backend build.
// Uses an isolated browser profile and fresh in-memory backend on test ports.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../../', import.meta.url))
const temp = await mkdtemp(join(tmpdir(), 'careerquest-smoke-'))
const processes = []
let socket
let nextId = 0
const pending = new Map()
const logs = []
function start(command, args, env = {}) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (data) => logs.push(data.toString()))
  child.stderr.on('data', (data) => logs.push(data.toString()))
  child.on('error', (error) => logs.push(error.message))
  processes.push(child)
  return child
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitFor(check, label) {
  for (let i = 0; i < 100; i += 1) {
    try { if (await check()) return } catch { /* Wait for startup/render. */ }
    await delay(100)
  }
  throw new Error(`Timed out: ${label}`)
}
function command(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const text = () => evaluate('document.body.innerText')
const click = (label) => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`)
const select = (id) => evaluate(`(() => { const s = document.querySelector('#employee-select'); s.value = ${JSON.stringify(id)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`)
async function waitText(value) { await waitFor(async () => (await text()).includes(value), value) }

async function assertSkillDisplays(profile) {
  const displayed = await evaluate(`['assessed', 'target'].map(prefix =>
    [...document.querySelectorAll('progress[id^="' + prefix + '-"]')].map(bar => ({
      id: bar.id.slice(prefix.length + 1),
      label: bar.closest('.skill').querySelector('strong').textContent,
      status: bar.closest('.skill').querySelector('.met-tag, .gap-tag').textContent,
      fill: bar.position,
    })))`)
  const expected = profile.skills.map(skill => ({
    id: skill.skill_id,
    label: `${skill.current_level}/${skill.required_level}`,
    status: skill.current_level > skill.required_level ? 'Target exceeded'
      : skill.current_level === skill.required_level ? 'Target met'
      : `${skill.gap} level${skill.gap === 1 ? '' : 's'} remaining`,
    fill: skill.required_level === 0 ? 1 : Math.min(1, skill.current_level / skill.required_level),
  }))
  assert.deepEqual(displayed, [expected, expected])
  assert.equal(await evaluate("document.querySelector('.growth-ring-inner span').textContent"), 'Target requirements met')
  assert.equal(await evaluate("document.querySelector('.growth-ring-inner strong').textContent"),
    `${Math.round(profile.readiness.requirements_met / profile.readiness.requirements_total * 100)}%`)
}

try {
  start(process.execPath, ['backend/dist/server.js'], { OPENAI_API_KEY: '', PORT: '18000', CORS_ORIGIN: 'http://localhost:15173' })
  start(process.execPath, ['frontend/node_modules/vite/bin/vite.js', 'frontend', '--host', 'localhost', '--port', '15173', '--strictPort'], { VITE_API_BASE_URL: 'http://localhost:18000/api' })
  await waitFor(async () => (await fetch('http://localhost:18000/api/employees')).ok, 'backend startup')
  await waitFor(async () => (await fetch('http://localhost:15173')).ok, 'frontend startup')
  start(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--remote-debugging-port=19223', `--user-data-dir=${temp}`, 'about:blank',
  ])
  let tab
  await waitFor(async () => {
    tab = (await (await fetch('http://localhost:19223/json')).json()).find((entry) => entry.type === 'page')
    return tab
  }, 'Chrome startup')
  socket = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  })
  await command('Page.navigate', { url: 'http://localhost:15173' })
  await waitText('Employee preview')
  await click('Employee preview')
  await waitText('Recommended activities')
  const employees = (await (await fetch('http://localhost:18000/api/employees')).json()).employees
  assert.equal(await evaluate("document.querySelectorAll('#employee-select option').length"), employees.length)
  console.log('PASS demo entry, employee list, profile, recommendations')

  await evaluate(`(() => { const input = document.querySelector('#employee-search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(employees[1].employee_id)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await waitText('1 matching profiles.')
  await select(employees[1].employee_id)
  await waitFor(async () => await evaluate("document.querySelector('.cq-profile h2')?.textContent") === employees[1].full_name, 'search and selection')
  await evaluate("(() => { const input = document.querySelector('#employee-search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); })()")
  console.log('PASS employee search and selection')

  // Intentionally delay one employee and ignore its AbortSignal to verify stale-result guards.
  await evaluate(`window.realFetch = window.fetch; window.fetch = async (url, options) => { if (String(url).includes('/employees/${employees[0].employee_id}')) { const r = await window.realFetch(url, { ...options, signal: undefined }); await new Promise(r => setTimeout(r, 700)); return r; } return window.realFetch(url, options); }`)
  await select(employees[0].employee_id)
  await delay(100)
  await select(employees[2].employee_id)
  await delay(1000)
  assert.equal(await evaluate("document.querySelector('.cq-profile h2')?.textContent"), employees[2].full_name)
  await evaluate('window.fetch = window.realFetch')
  await assertSkillDisplays(await (await fetch(`http://localhost:18000/api/employees/${employees[2].employee_id}`)).json())
  console.log('PASS rapid switching with delayed stale responses')

  // Explicit presentation fixtures cover every target relation, including zero targets.
  const displayProfile = await (await fetch(`http://localhost:18000/api/employees/${employees[1].employee_id}`)).json()
  displayProfile.skills = [
    { skill_id: 'BELOW', name: 'Below target', current_level: 3, required_level: 4, gap: 1 },
    { skill_id: 'MET', name: 'At target', current_level: 3, required_level: 3, gap: 0 },
    { skill_id: 'CICD', name: 'CI/CD', current_level: 4, required_level: 3, gap: 0 },
    { skill_id: 'ZERO', name: 'Zero target', current_level: 0, required_level: 0, gap: 0 },
    { skill_id: 'ABOVE_ZERO', name: 'Above zero target', current_level: 2, required_level: 0, gap: 0 },
  ]
  await evaluate(`window.fetch = (url, options) => String(url).endsWith('/employees/${employees[1].employee_id}')
    ? Promise.resolve(Response.json(${JSON.stringify(displayProfile)})) : window.realFetch(url, options)`)
  await select(employees[1].employee_id)
  await waitText('Target exceeded')
  await assertSkillDisplays(displayProfile)
  await evaluate('window.fetch = window.realFetch')
  console.log('PASS below-target, at-target, above-target CI/CD and zero-target displays in both sections')

  await select(employees[0].employee_id)
  await waitText('Recommended activities')
  const before = await (await fetch(`http://localhost:18000/api/employees/${employees[0].employee_id}`)).json()
  const recs = await (await fetch(`http://localhost:18000/api/employees/${employees[0].employee_id}/recommendations`)).json()
  await assertSkillDisplays(before)
  assert.ok((await text()).includes(recs.recommendations[0].explanation))
  assert.ok((await text()).includes('Activity can develop this skill up to level'))
  assert.ok((await text()).includes('Rule-based explanation'))
  await evaluate(`window.fetch = (url, options) => String(url).endsWith('/complete') ? Promise.resolve(Response.json({ error: { code: 'TEST_FAILURE', message: 'Completion test failure' } }, { status: 503 })) : window.realFetch(url, options)`)
  await click('Mark completed')
  await waitText('Completion test failure')
  assert.equal(await evaluate("document.querySelectorAll('.growth-celebration').length"), 0)
  await evaluate('window.fetch = window.realFetch; window.completionRequests = 0; window.fetch = async (url, options) => { if (String(url).endsWith("/complete")) { window.completionRequests++; await new Promise(r => setTimeout(r, 200)); } if (String(url).endsWith("/recommendations")) throw new TypeError("Explanation refresh unavailable"); return window.realFetch(url, options); }')
  await evaluate("(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Mark completed'); b.click(); b.click(); })()")
  await waitText('A step worth celebrating!')
  assert.equal(await evaluate('window.completionRequests'), 1)
  await waitText('Progress saved. Explanation refresh unavailable')
  assert.equal(await evaluate("document.querySelectorAll('.recommendation-error').length"), 0)
  const after = await (await fetch(`http://localhost:18000/api/employees/${employees[0].employee_id}`)).json()
  await assertSkillDisplays(after)
  assert.equal(after.history.length, before.history.length + 1)
  assert.ok((await text()).includes(`${after.readiness.requirements_met} of ${after.readiness.requirements_total} requirements met`))
  const next = await (await fetch(`http://localhost:18000/api/employees/${employees[0].employee_id}/recommendations`)).json()
  assert.equal(await evaluate("document.querySelectorAll('.recommendation-card').length"), next.recommendations.length)
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.recommendation-card h3')].map(e => e.textContent)"), next.recommendations.map((item) => item.title))
  await evaluate('window.fetch = window.realFetch')
  console.log('PASS factors, failed completion, duplicate prevention, successful progress and recommendation refresh')

  // A delayed AI wording refresh must not hold completion open or overwrite another employee.
  await select(employees[1].employee_id)
  await waitFor(async () => await evaluate("document.querySelector('.cq-profile h2')?.textContent") === employees[1].full_name, 'second profile')
  await evaluate(`window.fetch = async (url, options) => {
    const response = await window.realFetch(url, { ...options, signal: undefined });
    if (String(url).endsWith('/recommendations')) {
      const data = await response.json();
      data.recommendations = data.recommendations.map(item => ({ ...item, explanation_source: 'ai' }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      return Response.json(data);
    }
    return response;
  }`)
  await click('Mark completed')
  await waitText('Progress saved. Refreshing explanation wording')
  await waitText('AI-assisted explanation · verified facts')
  assert.ok((await text()).includes('A step worth celebrating!'))
  await click('Mark completed')
  await waitText('Progress saved. Refreshing explanation wording')
  await evaluate('window.fetch = window.realFetch')
  await select(employees[0].employee_id)
  await waitFor(async () => await evaluate("document.querySelector('.cq-profile h2')?.textContent") === employees[0].full_name, 'return to first profile')
  await delay(1700)
  assert.equal(await evaluate("document.querySelector('.cq-profile h2').textContent"), employees[0].full_name)
  assert.ok(!(await text()).includes('AI-assisted explanation · verified facts'))
  console.log('PASS completion survives explanation failure; mocked AI labels and stale refresh isolation')

  await click('HR overview')
  await waitText('Completed activities')
  const hr = await (await fetch('http://localhost:18000/api/hr/overview')).json()
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.hr-stat strong')].map(e => Number(e.textContent))"), [hr.employee_count, hr.completed_activity_count, hr.employees_without_step.length])
  const document = JSON.parse(await readFile(join(root, 'employees.json'), 'utf8'))
  const skills = JSON.parse(await readFile(join(root, 'skills.json'), 'utf8'))
  const imported = { ...document.employees[0], employee_id: 'BROWSER_IMPORT', full_name: 'Browser Imported Employee', skills: Object.fromEntries(skills.skills.map((skill) => [skill.skill_id, 5])) }
  const upload = JSON.stringify({ meta: document.meta, employees: [imported] })
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File([${JSON.stringify(upload)}], 'employees.json', { type: 'application/json' })); const input = document.querySelector('#dataset-files'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  await click('Import selected files')
  await waitText('Import completed.')
  await waitFor(async () => await evaluate("Number(document.querySelector('.hr-stat strong')?.textContent)") === hr.employee_count + 1, 'HR refresh after import')
  await click('My growth')
  await waitText('Recommended activities')
  assert.equal(await evaluate("document.querySelector('#employee-select').value"), employees[0].employee_id)
  await select('BROWSER_IMPORT')
  await waitText('No suitable activities are currently available')
  assert.equal(await evaluate("document.querySelector('.cq-profile h2').textContent"), imported.full_name)
  console.log('PASS HR aggregates, multipart import, HR refresh, preserved selection, imported employee and empty recommendations')

  await evaluate('window.fetch = () => Promise.reject(new TypeError("Failed to fetch"))')
  await select(employees[1].employee_id)
  await waitText('Cannot reach the backend')
  await evaluate('window.fetch = window.realFetch')
  await click('Retry')
  await waitText('Recommended activities')
  assert.equal(await evaluate("document.querySelector('.cq-profile h2').textContent"), employees[1].full_name)
  console.log('PASS unavailable-backend error and retry')
} catch (error) {
  console.error(error)
  console.error(logs.slice(-12).join(''))
  process.exitCode = 1
} finally {
  socket?.close()
  for (const child of processes.reverse()) child.kill('SIGTERM')
  await delay(700)
  await rm(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
}
