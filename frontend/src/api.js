export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function request(path, { body, ...options } = {}) {
  const multipart = body instanceof FormData
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: body && !multipart ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(`Cannot reach the backend at ${API_BASE_URL}. Check that it is running and try again.`)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(data?.error?.message || `Request failed (HTTP ${response.status}). Please try again.`,
      response.status, data?.error?.code || 'HTTP_ERROR')
  }
  if (!data) throw new ApiError('The backend returned an invalid response. Please try again.', response.status, 'INVALID_RESPONSE')
  return data
}

const employeePath = (id) => `/employees/${encodeURIComponent(id)}`
export const api = {
  employees: (signal) => request('/employees', { signal }),
  employee: (id, signal) => request(employeePath(id), { signal }),
  recommendations: (id, signal) => request(`${employeePath(id)}/recommendations`, { signal }),
  complete: (id, eventId) => request(`${employeePath(id)}/complete`, { method: 'POST', body: { event_id: eventId } }),
  overview: (signal) => request('/hr/overview', { signal }),
  importFiles: (files) => {
    const body = new FormData()
    files.forEach((file) => body.append('files', file))
    return request('/import', { method: 'POST', body })
  },
}
