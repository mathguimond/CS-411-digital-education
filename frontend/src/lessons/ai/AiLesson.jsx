import { useEffect, useRef, useState } from 'react'
import AiTutor from './AiTutor.jsx'
import { lesson } from './content.js'
import Pretest from './activities/Pretest.jsx'
import Introduction from './activities/Introduction.jsx'
import Practice from './activities/Practice.jsx'
import Memoization from './activities/Memoization.jsx'
import Transfer from './activities/Transfer.jsx'
import useLessonStudy from './study/useLessonStudy.js'
import { canVisitPart, scorePretest, studyMetrics } from './study/lessonState.js'
import usePython from './python/usePython.js'
import './AiLesson.css'

const REQUIRED = [[], ['doll-explanation'], ['suitability', 'suitability-reason', 'fib-recurrence', 'fib-prediction', 'stack-prediction', 'trace-explanation'], ['repeated-count', 'redundancy-explanation', 'complexity-explanation'], ['transfer-recurrence', 'transfer-cache', 'transfer-complexity']]

function AssessmentResults({ session, download }) {
  const result = session.assessment
  const metrics = studyMetrics(session)
  const total = result.totalTests ?? 7
  const detected = (value) => value === true ? 'yes' : value === false ? 'no' : 'not assessed'
  return <div className="lesson-results">
    <p className="eyebrow">Lesson complete</p><h2 id="part-heading" tabIndex={-1}>You made the jump.</h2>
    <p>From recognizing smaller problems to remembering their results: you have practiced the foundations of dynamic programming.</p>
    <div className="comparison-stats"><div><strong>{session.baseline.score}/{session.baseline.total}</strong><span>Pre-test questions correct</span></div><div><strong>{result.tests.filter((test) => test.passed).length}/{total}</strong><span>Transfer tests passed</span></div><div><strong>{metrics.hintRequests}</strong><span>Practice hint requests</span></div></div>
    <h3>Your transfer assessment</h3>
    {result.error && <p className="error-message">{result.error}</p>}
    <ul className="assessment-checks"><li>Correct outputs: {!result.error && result.tests.length === total && result.tests.every((test) => test.passed) ? 'all checks passed' : 'some checks need attention'}</li><li>Recursive call detected: {detected(result.analysis.recursionUsed)}</li><li>Dictionary detected: {detected(result.analysis.dictionaryUsed)}</li><li>Call-count check: {result.efficiency ? result.efficiency.passed ? 'passed' : 'needs attention' : 'not assessed'}</li></ul>
    <p className="small muted">These are automated checks of outputs, code structure, and function-call counts. Your recurrence, cache explanation, and complexity reasoning are saved for organizer review. The call-count check alone does not prove a complexity bound.</p>
    <details className="concept-recap"><summary>View submitted test results</summary><ul className="test-results">{result.tests.map((test) => <li key={test.input}><span>n = {test.input}</span><span>{test.error || `Expected ${test.expected}; got ${String(test.actual)}`}</span></li>)}</ul></details>
    <button onClick={download}>Download my lesson record</button>
    <p className="muted small">Share the downloaded record with your organizer when asked. This pilot does not upload results automatically.</p>
  </div>
}

export default function AiLesson() {
  const { session, setSession, record, answer, code, download } = useLessonStudy(lesson.version)
  const [mobileTutor, setMobileTutor] = useState(false)
  const [editorBusy, setEditorBusy] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const python = usePython()
  const heading = useRef(null)
  const lastPart = useRef(null)
  const index = session.partIndex
  const part = lesson.parts[index]
  const tutorAllowed = part.ai_allowed !== false
  const busy = editorBusy || python.busy
  const complete = session.transferSubmitted
  const fieldsComplete = index === 0 ? lesson.pretest.every((question) => Number.isInteger(session.answers[question.id])) : REQUIRED[index].every((id) => String(session.answers[id] ?? '').trim())
  const activity = index === 2 ? 'fibonacci' : index === 3 ? 'memoization' : 'transfer'
  const practiceRun = index < 2 || index > 3 || session.events.some((event) => event.type === 'code_run_started' && event.activity === activity)
  const ready = fieldsComplete && practiceRun
  const learnerContext = !tutorAllowed ? '' : JSON.stringify({ baseline: session.baseline, code: index >= 2 ? session.code[activity].slice(0, 3500) : undefined, answers: Object.fromEntries(REQUIRED[index].map((id) => [id, String(session.answers[id] ?? '').slice(0, 350)])) }).slice(0, 6000)

  useEffect(() => {
    if (lastPart.current === part.id) return
    lastPart.current = part.id
    record('part_entered', { partId: part.id })
  }, [part.id, record])

  function visit(next) {
    if (busy || complete || !canVisitPart(session, next)) return
    setSession((value) => ({ ...value, partIndex: next }))
    setSubmissionError('')
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) })
  }

  function advance() {
    if (!ready || busy) return
    record('part_submitted', { partId: part.id, answers: index === 0 ? Object.fromEntries(lesson.pretest.map((question) => [question.id, session.answers[question.id]])) : Object.fromEntries(REQUIRED[index].map((id) => [id, session.answers[id]])) })
    setSession((value) => ({ ...value, completedParts: [...new Set([...value.completedParts, index])].sort(), partIndex: index + 1,
      ...(index === 0 ? { pretestSubmitted: true, baseline: scorePretest(lesson.pretest, value.answers) } : {}),
      ...(index === 3 ? { transferStarted: true } : {}),
    }))
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) })
  }

  async function submitTransfer() {
    if (!ready || busy || complete) return
    setSubmissionError('')
    record('transfer_submission_started', { code: session.code.transfer, answers: Object.fromEntries(REQUIRED[4].map((id) => [id, session.answers[id]])) })
    let assessment
    try {
      assessment = await python.execute(session.code.transfer, 'transfer', 'test')
    } catch (failure) {
      if (failure.code !== 'execution_timeout') {
        setSubmissionError('Assessment could not run. Your work is saved; please try submitting again. ' + failure.message)
        record('assessment_unavailable', { reason: failure.message })
        return
      }
      assessment = { tests: [], totalTests: 7, error: 'The submitted program exceeded the execution time limit.', analysis: {}, passed: false }
    }
    record('transfer_submitted', { result: assessment })
    setSession((value) => ({ ...value, assessment, transferSubmitted: true, completedAt: new Date().toISOString(), completedParts: [0, 1, 2, 3, 4] }))
    requestAnimationFrame(() => document.getElementById('part-heading')?.focus())
  }

  const common = { answers: session.answers, onChange: answer, record }
  return <main className="ai-lesson">
    <header className="lesson-header"><div className="brand"><span className="brand-mark" aria-hidden="true">↳</span>DYNAMIC LEARNING</div><span className="condition-badge">AI-assisted lesson · About 30 minutes</span></header>
    <div className="lesson-intro"><p className="eyebrow">Recursion → Memoization</p><h1>Thinking <span className="accent">recursively.</span></h1><p className="lead">Recognize the pattern. Build the solution. Make it faster.</p></div>
    <nav className="lesson-progress" aria-label="Lesson parts"><ol>{lesson.parts.map((item, position) => <li key={item.id}><button className={`progress-part ${position === index ? 'current' : ''} ${session.completedParts.includes(position) ? 'done' : ''}`} aria-current={position === index ? 'step' : undefined} disabled={busy || complete || !canVisitPart(session, position)} onClick={() => visit(position)}><span className="part-number">{session.completedParts.includes(position) ? '✓' : `0${position + 1}`}</span><span>{item.label}</span></button></li>)}</ol></nav>
    <div className={`workspace ${tutorAllowed ? '' : 'without-tutor'}`}>
      <section className="lesson-content" aria-labelledby="part-heading">
        {complete ? <AssessmentResults session={session} download={download} /> : <>
          <p className="eyebrow part-kicker">Part {index + 1} of 5 · {part.label}</p><h2 id="part-heading" tabIndex={-1} ref={heading}>{part.title}</h2>
          <div key={part.id}>
            {index === 0 && <Pretest questions={lesson.pretest} {...common} submitted={session.pretestSubmitted} />}
            {index === 1 && <Introduction {...common} />}
            {index === 2 && <Practice {...common} problems={lesson.suitability} code={session.code.fibonacci} onCode={(source) => code('fibonacci', source)} onBusyChange={setEditorBusy} />}
            {index === 3 && <Memoization {...common} code={session.code.memoization} onCode={(source) => code('memoization', source)} onBusyChange={setEditorBusy} />}
            {index === 4 && <Transfer {...common} code={session.code.transfer} onCode={(source) => code('transfer', source)} onBusyChange={setEditorBusy} submitted={python.busy} />}
          </div>
          <div className="part-actions">{index < 4 ? <button onClick={advance} disabled={!ready || busy}>{index === 0 ? 'Submit pre-test & continue' : index === 3 ? 'Start the transfer task' : 'Save & continue'}</button> : <button onClick={submitTransfer} disabled={!ready || busy}>{python.busy ? 'Assessing your submission…' : 'Submit final assessment'}</button>}
            <p className="small muted">{!fieldsComplete ? 'Complete each response to continue.' : !practiceRun ? 'Run your code at least once before continuing. It does not have to pass.' : index === 0 ? 'Submission locks your pre-test. Results appear at the end.' : index === 3 ? 'Starting the transfer task closes the earlier practice activities.' : index === 4 ? 'Submission locks your work and reveals the assessment.' : 'Your work is saved in this tab.'}</p>
          </div>
          {submissionError && <p className="error-message" role="alert">{submissionError}</p>}
        </>}
      </section>
      {tutorAllowed && <aside id="lesson-tutor" className={`support-panel ai-support ${mobileTutor ? 'mobile-open' : ''}`} aria-label="AI tutor"><button className="secondary mobile-tutor-close" onClick={() => setMobileTutor(false)}>Close tutor</button><AiTutor key={part.id} step={part} record={record} learnerContext={learnerContext} conversation={session.conversations?.[part.id] || []} onConversationChange={(messages) => setSession((value) => ({ ...value, conversations: { ...value.conversations, [part.id]: messages } }))} /></aside>}
    </div>
    {tutorAllowed && <button className="mobile-tutor-toggle" aria-controls="lesson-tutor" aria-expanded={mobileTutor} onClick={() => setMobileTutor((value) => !value)}>{mobileTutor ? 'Close tutor' : 'Ask the tutor ↗'}</button>}
    <footer className="lesson-footer"><p>Progress is saved in this browser tab. Python runs in your browser.</p><button className="text-button" onClick={download}>Download session record ↓</button></footer>
  </main>
}
