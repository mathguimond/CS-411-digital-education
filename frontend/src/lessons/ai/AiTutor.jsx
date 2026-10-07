import { useEffect, useRef, useState } from 'react'
import { askTutor, recentHistory } from '../../lib/api.js'

export default function AiTutor({ step, activity, record, learnerContext = '', conversation = [], onConversationChange, unlocked, onUnlock, onBusyChange }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeRequest = useRef(null)
  const transcript = useRef(null)
  useEffect(() => () => { activeRequest.current?.abort(); activeRequest.current = null }, [])
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])
  useEffect(() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight }, [conversation.length, busy])

  async function sendMessage(message, requestKind) {
    if (!message || activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 25000)
    setBusy(true); setError('')
    record('chat_requested', { activityId: activity.id, stepId: step.id, messageLength: message.length, supportMode: step.support_mode, requestKind })
    const started = performance.now()
    try {
      const history = recentHistory(conversation.filter((entry) => entry.activityId === activity.id))
      const reply = await askTutor({ message, history, stepId: step.id, signal: controller.signal, learnerContext })
      const tag = { activityId: activity.id, activityTitle: activity.title }
      onConversationChange([...conversation, { role: 'user', content: message, ...tag }, { role: 'assistant', content: reply, ...tag }])
      onUnlock(); setDraft('')
      record('chat_answered', { activityId: activity.id, stepId: step.id, requestKind, durationMs: Math.round(performance.now() - started) })
    } catch (failure) {
      if (!controller.signal.aborted || activeRequest.current) {
        setError(failure.name === 'AbortError' ? 'The hint took too long to arrive. Please try again.' : failure.message)
        record('chat_failed', { activityId: activity.id, stepId: step.id, requestKind })
      }
    } finally {
      clearTimeout(timeout); activeRequest.current = null; setBusy(false)
    }
  }

  return <>
    <p className="eyebrow">Help with your current activity</p><h2>A next step, when you need it.</h2>
    <p className="muted">Request a hint based on your answers, code, and call tree. Then ask follow-up questions about that hint.</p>
    <p className="small current-hint-activity"><strong>{activity.title}</strong></p>
    {conversation.length > 0 && <div className="chat-transcript" role="log" aria-label="Hint history" aria-live="polite" ref={transcript}>
      {conversation.map((entry, index) => <div key={index}>
        {entry.activityId !== conversation[index - 1]?.activityId && <p className="chat-activity-label">{entry.activityTitle}</p>}
        <div className={`chat-message ${entry.role}`}><span className="eyebrow">{entry.role === 'user' ? 'You' : 'AI hint'}</span><p>{entry.content}</p></div>
      </div>)}
    </div>}
    {busy && <p role="status" className="muted">Preparing your hint…</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {!unlocked ? <button className="full-width tutor-start" disabled={busy} onClick={() => sendMessage('Give me one small hint about my current attempt.', 'hint')}>{busy ? 'Preparing your hint…' : 'Ask for a hint'}</button> : <form onSubmit={(event) => { event.preventDefault(); sendMessage(draft.trim(), 'follow_up') }}>
      <label htmlFor="tutor-message">Ask a follow-up question</label><textarea id="tutor-message" rows={3} maxLength={4000} value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} placeholder="What about this hint needs clarification?" /><button className="full-width" type="submit" disabled={busy || !draft.trim()}>{busy ? 'Waiting for a reply…' : 'Send follow-up ↗'}</button>
    </form>}
    <p className="small muted">Your current attempt and messages are sent to Gemini. AI replies can contain mistakes.</p>
  </>
}
