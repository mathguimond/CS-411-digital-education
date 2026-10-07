import { useCallback, useEffect, useRef, useState } from 'react'
import { createLessonSession, currentActivity, studyMetrics } from './lessonState.js'

export default function useLessonStudy(version) {
  const storageKey = `dynamic-learning:ai:${version}`
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey))
      if (saved?.lessonVersion === version && saved.schemaVersion === 3 && Array.isArray(saved.events) && saved.answers && saved.code && saved.trees && saved.completedActivities) return saved
    } catch { /* Continue in memory if browser storage is unavailable. */ }
    return createLessonSession(version)
  })
  const current = useRef(session)
  const lastActivity = useRef(0)
  const lastEdit = useRef({})

  useEffect(() => {
    current.current = session
    try { sessionStorage.setItem(storageKey, JSON.stringify(session)) } catch { /* Export is still available. */ }
  }, [session, storageKey])

  useEffect(() => {
    let previous = Date.now()
    lastActivity.current = previous
    const interact = () => { lastActivity.current = Date.now() }
    const visibility = () => { previous = Date.now() }
    const save = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(current.current)) } catch { /* Optional browser storage. */ } }
    const timer = setInterval(() => {
      const now = Date.now(), elapsed = now - previous
      previous = now
      if (document.visibilityState !== 'visible' || now - lastActivity.current > 60000 || current.current.transferSubmitted) return
      const part = current.current.partIndex
      const activityId = currentActivity(current.current).id
      const focused = document.activeElement
      const activity = !focused?.disabled && focused?.dataset.codeActivity
      setSession((value) => ({ ...value, activeMsByPart: { ...value.activeMsByPart, [part]: (value.activeMsByPart[part] || 0) + elapsed },
        activeMsByActivity: { ...value.activeMsByActivity, [activityId]: (value.activeMsByActivity[activityId] || 0) + elapsed },
        activeMsByEditor: activity ? { ...value.activeMsByEditor, [activity]: (value.activeMsByEditor?.[activity] || 0) + elapsed } : value.activeMsByEditor,
      }))
    }, 1000)
    for (const event of ['pointerdown', 'keydown', 'pointermove']) document.addEventListener(event, interact, { passive: true })
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      clearInterval(timer)
      for (const event of ['pointerdown', 'keydown', 'pointermove']) document.removeEventListener(event, interact)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [storageKey])

  const record = useCallback((type, details = {}) => {
    const event = { id: crypto.randomUUID(), type, timestamp: new Date().toISOString(), activityId: currentActivity(current.current).id, ...details }
    setSession((value) => ({ ...value, events: [...value.events, event],
      lastResults: type === 'code_run_finished' || type === 'code_run_failed' ? { ...value.lastResults, [details.activity]: type === 'code_run_finished' ? details.result : { error: details.reason, tests: [] } } : value.lastResults,
    }))
  }, [])

  const answer = useCallback((id, value) => {
    const now = Date.now()
    if (now - (lastEdit.current[id] || 0) > 700) record('response_edited', { field: id })
    lastEdit.current[id] = now
    setSession((previous) => ({ ...previous, answers: { ...previous.answers, [id]: value } }))
  }, [record])

  const code = useCallback((activity, source) => {
    const now = Date.now(), key = `code-${activity}`
    if (now - (lastEdit.current[key] || 0) > 700) record('code_edited', { activity })
    lastEdit.current[key] = now
    setSession((previous) => ({ ...previous, code: { ...previous.code, [activity]: source },
      lastResults: previous.lastResults[activity] ? { ...previous.lastResults, [activity]: { ...previous.lastResults[activity], codeChangedSinceRun: true } } : previous.lastResults,
    }))
  }, [record])

  const download = useCallback(() => {
    const value = current.current
    const exported = { ...value }
    delete exported.chatHistory
    const blob = new Blob([JSON.stringify({ ...exported, metrics: studyMetrics(value) }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `dynamic-learning-ai-${value.sessionId}.json`
    document.body.append(anchor); anchor.click(); anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  return { session, setSession, record, answer, code, download }
}
