import { useCallback, useState } from 'react'

// A development foundation for analysis. No participant data is sent to a server.
export default function useStudySession(condition, lessonVersion) {
  const [session] = useState(() => ({
    schemaVersion: 1,
    sessionId: crypto.randomUUID(),
    condition,
    lessonVersion,
    startedAt: new Date().toISOString(),
    events: [],
  }))

  const record = useCallback((type, details = {}) => {
    session.events.push({ type, timestamp: new Date().toISOString(), ...details })
  }, [session])

  const download = useCallback(() => {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `recursion-${condition}-${session.sessionId}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [condition, session])

  return { record, download }
}
