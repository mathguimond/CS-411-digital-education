import { useCallback, useEffect, useState } from 'react'
import { useStudyAuth } from '../../../auth/authContext.js'
import { currentActivity } from './lessonState.js'

export default function useLessonStudy() {
  const { store } = useStudyAuth()
  const [, redraw] = useState(0)
  useEffect(() => store.subscribe(() => redraw((value) => value + 1)), [store])
  useEffect(() => store.start(), [store])
  useEffect(() => {
    let lastInput = Date.now(), previous = Date.now()
    const interact = () => { lastInput = Date.now() }
    const timer = setInterval(() => {
      const now = Date.now(), elapsed = now - previous
      previous = now
      if (document.visibilityState !== 'visible' || now - lastInput > 60000 || store.session.transferSubmitted || store.busy === 'checkpoint') return
      const part = store.session.partIndex, activity = currentActivity(store.session).id, editor = document.activeElement?.dataset.codeActivity
      store.update((session) => ({ ...session,
        activeMsByPart: { ...session.activeMsByPart, [part]: (session.activeMsByPart[part] || 0) + elapsed },
        activeMsByActivity: { ...session.activeMsByActivity, [activity]: (session.activeMsByActivity[activity] || 0) + elapsed },
        activeMsByEditor: editor ? { ...session.activeMsByEditor, [editor]: (session.activeMsByEditor[editor] || 0) + elapsed } : session.activeMsByEditor,
      }))
    }, 5000)
    for (const type of ['pointerdown', 'keydown', 'pointermove']) document.addEventListener(type, interact, { passive: true })
    return () => { clearInterval(timer); for (const type of ['pointerdown', 'keydown', 'pointermove']) document.removeEventListener(type, interact) }
  }, [store])
  const setSession = useCallback((change) => store.update(change), [store])
  const record = useCallback((type, details = {}) => {
    store.record(type, details)
    if (type === 'code_run_finished' || type === 'code_run_failed' && details.failureCode === 'execution_timeout') {
      store.update((session) => ({ ...session, codeRuns: { ...session.codeRuns, [details.codeKey]: true }, lastResults: { ...session.lastResults, [details.codeKey]: details.result || { tests: [], analysis: {}, passed: false, error: details.reason } } }))
    }
  }, [store])
  const answer = useCallback((id, value) => {
    store.update((session) => ({ ...session, answers: { ...session.answers, [id]: value } }))
    store.record('response_edited', { questionId: id, value })
  }, [store])
  const code = useCallback((key, source) => {
    store.update((session) => ({ ...session, code: { ...session.code, [key]: source } }))
    store.record('code_edited', { codeKey: key, source })
  }, [store])
  return { session: store.session, setSession, record, answer, code, store }
}
