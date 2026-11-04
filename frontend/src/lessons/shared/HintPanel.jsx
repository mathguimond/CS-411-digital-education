import { useEffect, useRef, useState } from 'react'
import config from '../../../../shared/study-config.json'
import { lesson } from './content.js'

export default function HintPanel({ session, store, conversational }) {
  const [drafts, setDrafts] = useState({})
  const transcript = useRef(null)
  const questionId = session.activeQuestionId, question = lesson.questions[questionId]
  const draft = drafts[questionId] || ''
  const setDraft = (value) => setDrafts((previous) => ({ ...previous, [questionId]: value }))
  const limit = question ? config.hintLimits[question.kind] || 0 : 0
  const remaining = limit - (session.hintUsage[questionId] || 0)
  const busy = store.busy === 'hint'
  useEffect(() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight }, [session.chatHistory.length, busy])
  async function send(event) {
    event.preventDefault()
    if (!draft.trim() || busy || remaining <= 0) return
    await store.requestHint(questionId, draft.trim()); setDraft('')
  }
  return <>
    <p className="eyebrow">Help with your current question</p><h2>A next step, when you need it.</h2>
    {question ? <><p className="small current-hint-activity"><strong>{question.prompt}</strong></p><p className="small muted">{Math.max(0, remaining)} of {limit} hints remaining for this question. Each reply uses one hint.</p></> : <p className="muted">Use the lightbulb beside a question, call tree, or Python editor to request a hint.</p>}
    {session.chatHistory.length > 0 && <div className="chat-transcript" role="log" aria-label="Hint history" aria-live="polite" ref={transcript}>{session.chatHistory.map((entry, index) => <div key={index}>
      {entry.questionId !== session.chatHistory[index - 1]?.questionId && <p className="chat-activity-label">{entry.questionTitle}</p>}
      <div className={`chat-message ${entry.role}`}><span className="eyebrow">{entry.role === 'user' ? 'You' : conversational ? 'AI hint' : 'Prepared hint'}</span><p>{entry.content}</p></div>
    </div>)}</div>}
    {busy && <p role="status" className="muted">Preparing your hint…</p>}
    {store.hintError && <p role="alert" className="error-message">{store.hintError}</p>}
    {question && conversational && <form onSubmit={send}><label htmlFor="tutor-message">Ask a follow-up question</label><textarea id="tutor-message" rows={2} maxLength={4000} value={draft} disabled={busy || remaining <= 0} onChange={(event) => setDraft(event.target.value)} placeholder={remaining > 0 ? 'Ask about this question or hint…' : 'All hints for this question have been used.'} /><button className="full-width" disabled={busy || remaining <= 0 || !draft.trim()}>Send follow-up ↗</button></form>}
    {question && !conversational && <button className="secondary full-width" disabled={busy || remaining <= 0} onClick={() => store.requestHint(questionId)}>{remaining > 0 ? 'Reveal next hint' : 'All hints used for this question'}</button>}
  </>
}
