import { useEffect, useRef, useState } from 'react'
import { askTutor, recentHistory } from '../../lib/api.js'

export default function AiTutor({ step, record }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeRequest = useRef(null)
  const transcript = useRef(null)

  useEffect(() => () => activeRequest.current?.abort(), [])
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [messages, busy])

  async function send(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 25000)
    setBusy(true)
    setError('')
    record('chat_requested', { stepId: step.id, messageLength: message.length })
    const started = performance.now()
    try {
      const reply = await askTutor({ message, history: recentHistory(messages), stepId: step.id, signal: controller.signal })
      setMessages([...messages, { role: 'user', content: message }, { role: 'assistant', content: reply }])
      setDraft('')
      record('chat_answered', { stepId: step.id, durationMs: Math.round(performance.now() - started) })
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'The tutor took too long to respond. Please try again.' : failure.message)
      record('chat_failed', { stepId: step.id })
    } finally {
      clearTimeout(timeout)
      activeRequest.current = null
      setBusy(false)
    }
  }

  return (
    <>
      <p className="eyebrow">Your learning tools</p><h2>Think with a tutor</h2>
      <p className="muted">Ask for a hint, an explanation, or a worked answer. Your messages are sent to Gemini. Avoid personal information.</p>
      <div className="chat-transcript" role="log" aria-label="Tutor conversation" aria-live="polite" ref={transcript}>
        {messages.length === 0 && <div className="chat-empty"><span aria-hidden="true">↳</span><p>Where are you getting stuck?</p><small>Try “Can you give me a hint?”</small></div>}
        {messages.map((entry, index) => <div className={`chat-message ${entry.role}`} key={index}><span className="eyebrow">{entry.role === 'user' ? 'You' : 'Tutor'}</span><p>{entry.content}</p></div>)}
        {busy && <p role="status" className="muted">The tutor is thinking…</p>}
      </div>
      {error && <p role="alert" className="error-message">{error}</p>}
      <form onSubmit={send}><label htmlFor="tutor-message">Ask the tutor</label><textarea id="tutor-message" rows={3} maxLength={4000} value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} placeholder="What would you like to understand?" /><button className="full-width" type="submit" disabled={busy || !draft.trim()}>{busy ? 'Waiting for tutor…' : 'Send message ↗'}</button></form>
      <p className="small muted">AI answers can contain mistakes. Check the reasoning against the lesson.</p>
    </>
  )
}
