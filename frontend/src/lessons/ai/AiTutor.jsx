import { useEffect, useRef, useState } from 'react'
import { askTutor, recentHistory } from '../../lib/api.js'

export default function AiTutor({ step, record, learnerContext = '', conversation = [], onConversationChange }) {
  const [messages, setMessages] = useState(conversation)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeRequest = useRef(null)
  const transcript = useRef(null)
  const clarificationOnly = step.support_mode === 'clarifications'
  const concept = step.support_mode === 'concept'

  useEffect(() => () => activeRequest.current?.abort(), [])
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [messages, busy])

  async function send(event) {
    event.preventDefault()
    await sendMessage(draft.trim())
  }

  async function sendMessage(message) {
    if (!message || activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 25000)
    setBusy(true)
    setError('')
    record('chat_requested', { stepId: step.id, messageLength: message.length, supportMode: step.support_mode })
    const started = performance.now()
    try {
      const reply = await askTutor({ message, history: recentHistory(messages), stepId: step.id, signal: controller.signal, learnerContext: clarificationOnly ? '' : learnerContext.slice(0, 6000) })
      const next = [...messages, { role: 'user', content: message }, { role: 'assistant', content: reply }]
      setMessages(next)
      onConversationChange?.(next)
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
      <p className="eyebrow">{clarificationOnly ? 'Assessment support' : 'Your learning tools'}</p><h2>{clarificationOnly ? 'Clarify the task' : 'Think with a tutor'}</h2>
      <p className="muted">{clarificationOnly ? 'Ask about the instructions or interface. The tutor cannot give hints, code, answers, or feedback during this assessment.' : concept ? 'Explore recursion through a conversation. The tutor will ask short check-in questions and adapt to your replies.' : 'Ask for one targeted hint about your own attempt. The tutor helps you reason without revealing the solution.'}</p>
      {messages.length === 0 && <button className="secondary full-width tutor-start" disabled={busy} onClick={() => sendMessage(clarificationOnly ? 'Can you clarify what I need to submit?' : concept ? 'Introduce recursion using the nesting dolls and ask me one quick check-in question.' : 'Give me one small hint about my current attempt.')}>{clarificationOnly ? 'Clarify the instructions' : concept ? 'Start the conversation' : 'Ask for a first hint'}</button>}
      <div className="chat-transcript" role="log" aria-label="Tutor conversation" aria-live="polite" ref={transcript}>
        {messages.length === 0 && <div className="chat-empty"><span aria-hidden="true">↳</span><p>{clarificationOnly ? 'What wording needs clarifying?' : 'Where are you getting stuck?'}</p><small>{clarificationOnly ? 'Your solution stays your own.' : 'One question, one next step.'}</small></div>}
        {messages.map((entry, index) => <div className={`chat-message ${entry.role}`} key={index}><span className="eyebrow">{entry.role === 'user' ? 'You' : 'Tutor'}</span><p>{entry.content}</p></div>)}
        {busy && <p role="status" className="muted">The tutor is thinking…</p>}
      </div>
      {error && <p role="alert" className="error-message">{error}</p>}
      <form onSubmit={send}><label htmlFor="tutor-message">Ask the tutor</label><textarea id="tutor-message" rows={3} maxLength={4000} value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} placeholder="What would you like to understand?" /><button className="full-width" type="submit" disabled={busy || !draft.trim()}>{busy ? 'Waiting for tutor…' : 'Send message ↗'}</button></form>
      <p className="small muted">Messages {clarificationOnly ? '' : 'and your current attempt '}are sent to Gemini. Avoid personal information. AI replies can contain mistakes.</p>
    </>
  )
}
