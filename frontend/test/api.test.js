import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { api, API_BASE_URL, ApiError } from '../src/api.js'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('employee reads use the configured base, encoded IDs, and cancellation signal', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${API_BASE_URL}/employees/employee%2Fnew`)
    assert.equal(options.signal, controller.signal)
    return Response.json({ employee_id: 'employee/new' })
  }
  assert.deepEqual(await api.employee('employee/new', controller.signal), { employee_id: 'employee/new' })
})

test('completion sends the contract JSON body and accepts HTTP 201', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${API_BASE_URL}/employees/E1/complete`)
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { event_id: 'EVENT' })
    return Response.json({ status: 'completed', profile: {}, recommendations: [] }, { status: 201 })
  }
  assert.equal((await api.complete('E1', 'EVENT')).status, 'completed')
})

test('multipart import uses repeated files fields and leaves Content-Type to the browser', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${API_BASE_URL}/import`)
    assert.equal(options.method, 'POST')
    assert.equal(options.headers, undefined)
    assert.ok(options.body instanceof FormData)
    assert.deepEqual(options.body.getAll('files').map((file) => file.name), ['employees.json', 'activity_history.csv'])
    return Response.json({ imported_employee_ids: ['NEW'] })
  }
  await api.importFiles([new File(['{}'], 'employees.json'), new File([''], 'activity_history.csv')])
})

test('contract errors retain the readable message, code, and status', async () => {
  globalThis.fetch = async () => Response.json({ error: { code: 'EVENT_ALREADY_COMPLETED', message: 'Already completed.' } }, { status: 409 })
  await assert.rejects(api.complete('E1', 'EVENT'), (error) =>
    error instanceof ApiError && error.status === 409 && error.code === 'EVENT_ALREADY_COMPLETED' && error.message === 'Already completed.')
})

test('unavailable backend, non-JSON failures, and invalid success responses remain visible', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(api.employees(), /Cannot reach the backend/)
  globalThis.fetch = async () => new Response('Bad gateway', { status: 502 })
  await assert.rejects(api.employees(), /HTTP 502/)
  globalThis.fetch = async () => new Response('<html>wrong server</html>')
  await assert.rejects(api.employees(), /invalid response/)
})

test('abort is preserved and zero recommendations are a successful response', async () => {
  globalThis.fetch = async () => { throw new DOMException('Aborted', 'AbortError') }
  await assert.rejects(api.employees(), { name: 'AbortError' })
  globalThis.fetch = async () => Response.json({ recommendations: [] })
  assert.deepEqual((await api.recommendations('E1')).recommendations, [])
})
