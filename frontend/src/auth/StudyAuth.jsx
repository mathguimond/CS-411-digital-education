import { useCallback, useEffect, useState } from 'react'
import { AUTH_STORAGE_KEY, newParticipantToken, studyRequest } from '../lib/studyApi.js'
import { AuthContext } from './authContext.js'
import { StudyStore } from '../lessons/shared/study/StudyStore.js'

const readToken = () => { try { return localStorage.getItem(AUTH_STORAGE_KEY) } catch { return null } }

export function StudyAuthProvider({ children }) {
  const [token, setToken] = useState(readToken)
  const [data, setData] = useState(null)
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const initialize = useCallback((result, sessionToken) => {
    setToken(sessionToken); setData(result)
    setStore(new StudyStore({ token: sessionToken, remote: result }))
    setLoading(false); setError('')
  }, [])
  useEffect(() => {
    if (!token || data) return
    const controller = new AbortController()
    studyRequest('/session', { token, signal: controller.signal }).then((result) => {
      initialize(result, token)
    }).catch((failure) => {
      if (failure.name === 'AbortError') return
      if (failure.status === 401) { setData(null); setToken(null); localStorage.removeItem(AUTH_STORAGE_KEY) }
      else setError(failure.message)
      setLoading(false)
    })
    return () => controller.abort()
  }, [token, data, attempt, initialize])

  async function enroll(details) {
    const sessionToken = token || readToken() || newParticipantToken()
    localStorage.setItem(AUTH_STORAGE_KEY, sessionToken)
    const result = await studyRequest('/enroll', { method: 'POST', body: { ...details, session_token: sessionToken } })
    initialize(result, sessionToken)
    return result
  }
  const retry = () => { setLoading(true); setError(''); setAttempt((value) => value + 1) }
  return <AuthContext.Provider value={{ token, data, store, loading, error, enroll, retry }}>{children}</AuthContext.Provider>
}
