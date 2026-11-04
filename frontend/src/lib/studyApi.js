export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '')
export const AUTH_STORAGE_KEY = 'dynamic-learning:participant-token'

export class StudyApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code }
}

export async function studyRequest(path, { token, body, method = 'GET', signal, keepalive = false } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/study${path}`, {
      method, signal, keepalive,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new StudyApiError('Your connection was interrupted. Your work is saved on this device; reconnect to continue.', 0, 'network_error')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new StudyApiError(data?.error || 'The study server could not complete that request. Please try again.', response.status, data?.error_code)
  if (!data) throw new StudyApiError('The study server returned an unreadable response. Please try again.', 502, 'invalid_response')
  return data
}

export function newParticipantToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((value) => value.toString(16).padStart(2, '0')).join('')
}
