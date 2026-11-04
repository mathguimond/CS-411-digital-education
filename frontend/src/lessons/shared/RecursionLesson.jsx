import { useEffect, useRef, useState } from 'react'
import { lesson } from './content.js'
import config from '../../../../shared/study-config.json'
import Pretest from './activities/Pretest.jsx'
import Introduction from './activities/Introduction.jsx'
import Practice from './activities/Practice.jsx'
import Memoization from './activities/Memoization.jsx'
import Transfer from './activities/Transfer.jsx'
import Reflection from './activities/Reflection.jsx'
import { HintContext } from './activities/hintContext.js'
import { ACTIVITIES, canVisitActivity } from './activities/activityPlan.js'
import useLessonStudy from './study/useLessonStudy.js'
import { canVisitPart, currentActivity, hasResponse } from './study/lessonState.js'
import { assessCallTree } from './visualizations/treeModel.js'
import usePython from './python/usePython.js'
import './RecursionLesson.css'

const formatTime = (milliseconds) => `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, '0')}`

function Results({ session, elapsed }) {
  const result = session.assessment
  return <div className="lesson-results"><p className="eyebrow">Lesson complete</p><h2 id="part-heading" tabIndex={-1}>Thank you for completing the lesson.</h2><p>Your responses and lesson activity have been saved. Thank you for taking part in the Dynamic Learning study.</p><div className="comparison-stats"><div><strong>{session.baseline?.score ?? 0}/{session.baseline?.total ?? 3}</strong><span>Diagnostic questions correct</span></div><div><strong>{result?.tests?.filter((test) => test.passed).length ?? 0}/{result?.totalTests ?? 11}</strong><span>Final Python tests passed</span></div><div><strong>{formatTime(elapsed || 0)}</strong><span>Elapsed lesson time</span></div></div>{result?.error && <p className="error-message">{result.error}</p>}<p className="small muted">Your written reasoning and call-tree attempt are saved for organizer review. You can now close this page.</p></div>
}

export default function RecursionLesson({ condition, Support }) {
  const { session, setSession, record, answer, code, store } = useLessonStudy()
  const [mobileSupport, setMobileSupport] = useState(false)
  const [editorBusy, setEditorBusy] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [, tick] = useState(0)
  const finalPython = usePython(), heading = useRef(null), lastActivity = useRef(null)
  const index = session.partIndex, part = lesson.parts[index], activity = currentActivity(session)
  const position = session.activityIndexByPart[index] || 0
  const complete = session.surveySubmitted
  const supportAllowed = part.ai_allowed !== false && !complete
  const busy = Boolean(store.busy || editorBusy || finalPython.busy)
  const locked = store.busy === 'checkpoint' || finalPython.busy || Boolean(store.cache.pendingCheckpoint)
  const questions = index === 0 ? lesson.pretest : activity.fields.map((id) => lesson.questions[id])
  const fieldsComplete = questions.every((question) => hasResponse(question, session.answers))
  const runComplete = !activity.run || session.codeRuns[activity.code]
  const ready = fieldsComplete && runComplete
  const lastInPart = position === ACTIVITIES[index].length - 1
  const elapsed = store.elapsedMs()

  useEffect(() => { const timer = setInterval(() => tick((value) => value + 1), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    if (lastActivity.current === activity.id || complete) return
    lastActivity.current = activity.id
    record('activity_entered', { partId: part.id, activityId: activity.id })
  }, [activity.id, part.id, record, complete])
  function focusHeading() { requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) }) }
  function visit(next, nextActivity) {
    if (busy || locked || complete || !canVisitPart(session, next) || nextActivity !== undefined && !canVisitActivity(session, next, nextActivity)) return
    record('activity_navigation', { destinationPart: next, destinationActivity: nextActivity })
    setSession((value) => ({ ...value, activeQuestionId: null, partIndex: next, activityIndexByPart: nextActivity === undefined ? value.activityIndexByPart : { ...value.activityIndexByPart, [next]: nextActivity } }))
    setSubmissionError(''); focusHeading()
  }
  async function advance() {
    if ((!ready && !store.cache.pendingCheckpoint) || busy) return
    setSubmissionError('')
    record('continue_clicked', { activityId: activity.id })
    try {
      if (activity.id === 'grid-optimize' && !store.cache.pendingCheckpoint) {
        let assessment = session.lastResults.transferMemo
        if (!assessment || assessment.source !== session.code.transferMemo) {
          try { assessment = await finalPython.execute(session.code.transferMemo, 'transfer', 'test') } catch (failure) {
            if (failure.code !== 'execution_timeout') throw failure
            assessment = { tests: [], totalTests: 11, analysis: {}, passed: false, error: 'The submitted program exceeded the execution time limit.' }
          }
        }
        setSession((value) => ({ ...value, assessment: { ...assessment, treeAssessment: assessCallTree(value.trees.grid) } }))
      }
      await store.checkpoint(); focusHeading()
    } catch (failure) { setSubmissionError(failure.message) }
  }
  const common = { activity, answers: session.answers, onChange: answer, record, onBusyChange: setEditorBusy }
  const changeTree = (key) => (tree) => setSession((value) => ({ ...value, trees: { ...value.trees, [key]: tree } }))
  const actionLabel = store.cache.pendingCheckpoint ? 'Retry save and continue' : index === 0 ? 'Submit pre-test and start lesson!' : index === 5 ? 'Submit feedback and finish' : activity.id === 'grid-optimize' ? 'Complete transfer and continue' : index === 3 && lastInPart ? 'Start the transfer task' : lastInPart ? 'Save and continue' : 'Continue to the next activity'
  const hintContext = { enabled: supportAllowed, usage: session.hintUsage, busy, onRequest: (questionId) => { setMobileSupport(true); store.requestHint(questionId) } }
  return <main className="recursion-lesson">
    <header className="lesson-header"><div className="brand"><span className="brand-mark" aria-hidden="true">↳</span>DYNAMIC LEARNING</div><div className="lesson-status"><span className="condition-badge">{condition === 'ai' ? 'AI-assisted lesson' : 'Control lesson'}</span>{elapsed !== null && <span className="lesson-timer" role="timer" aria-label="Elapsed lesson time">{formatTime(elapsed)} elapsed{session.transferSubmitted ? ' · stopped' : ' / 30:00 target'}</span>}</div></header>
    <div className="lesson-intro"><p className="eyebrow">Recursion → Memoization</p><h1>Thinking <span className="accent">recursively.</span></h1><p className="lead">Recognize the pattern. Build the solution. Make it faster.</p></div>
    {elapsed >= config.lessonTargetMs && !session.transferSubmitted && <p className="overtime-notice" role="status">You’ve passed the 30-minute target. Keep moving through the lesson, and consider using a hint if you’re stuck.</p>}
    <nav className="lesson-progress" aria-label="Lesson parts"><ol>{lesson.parts.map((item, p) => <li key={item.id}><button className={`progress-part ${p === index ? 'current' : ''} ${session.completedParts.includes(p) ? 'done' : ''}`} aria-current={p === index ? 'step' : undefined} disabled={busy || locked || complete || !canVisitPart(session, p)} onClick={() => visit(p)}><span className="part-number">{session.completedParts.includes(p) ? '✓' : `0${p + 1}`}</span><span>{item.label}</span></button></li>)}</ol></nav>
    {store.saveError && <div className="save-notice" role="alert"><p>{store.saveError}</p>{!store.blocked && !store.cache.pendingCheckpoint && <button className="secondary" onClick={() => store.flush().catch(() => {})}>Retry saving</button>}</div>}
    <HintContext.Provider value={hintContext}><div className={`workspace ${supportAllowed ? '' : 'without-support'}`}>
      <section className="lesson-content" aria-labelledby="part-heading">{complete ? <Results session={session} elapsed={elapsed} /> : <>
        <p className="eyebrow part-kicker">Part {index + 1} of {lesson.parts.length} · {part.label}</p><h2 id="part-heading" tabIndex={-1} ref={heading}>{part.title}</h2>
        {ACTIVITIES[index].length > 1 && <nav className="activity-progress" aria-label="Activities in this part">{ACTIVITIES[index].map((item, i) => <button key={item.id} className={`secondary ${i === position ? 'current' : ''}`} aria-current={i === position ? 'step' : undefined} disabled={busy || locked || !canVisitActivity(session, index, i)} onClick={() => visit(index, i)}>{session.completedActivities.includes(item.id) ? '✓' : i + 1} · {item.title}</button>)}</nav>}
        <h3 className="activity-title">{activity.title}</h3><fieldset className="plain-fieldset" disabled={locked}><div key={activity.id}>
          {index === 0 && <Pretest questions={lesson.pretest} {...common} />}
          {index === 1 && <Introduction {...common} />}
          {index === 2 && <Practice {...common} code={session.code.stairs} onCode={(source) => code('stairs', source)} tree={session.trees.stairs} onTree={changeTree('stairs')} />}
          {index === 3 && <Memoization {...common} code={session.code.memoization} onCode={(source) => code('memoization', source)} tree={session.trees.stairs} />}
          {index === 4 && <Transfer {...common} code={session.code[activity.code]} onCode={(source) => code(activity.code, source)} tree={session.trees.grid} onTree={changeTree('grid')} />}
          {index === 5 && <Reflection {...common} condition={condition} />}
        </div></fieldset><div className="part-actions"><button onClick={advance} disabled={(!ready && !store.cache.pendingCheckpoint) || busy || store.blocked}>{busy && store.busy !== 'hint' ? 'Saving your work…' : actionLabel}</button><p className="small muted">{!fieldsComplete ? 'Answer each question to continue.' : !runComplete ? 'Run your Python code before continuing; it does not have to pass.' : index === 0 ? 'The 30-minute lesson timer starts when you submit.' : 'Your responses are saved when you continue.'}</p></div>{submissionError && <p className="error-message" role="alert">{submissionError}</p>}
      </>}</section>
      {supportAllowed && <aside id="lesson-support" className={`support-panel lesson-support-panel ${mobileSupport ? 'mobile-open' : ''}`} aria-label={condition === 'ai' ? 'AI hints' : 'Fixed hints'}><button className="secondary mobile-support-close" onClick={() => setMobileSupport(false)}>Close hints</button><Support session={session} store={store} /></aside>}
    </div></HintContext.Provider>
    {supportAllowed && <button className="mobile-support-toggle" aria-controls="lesson-support" aria-expanded={mobileSupport} onClick={() => setMobileSupport((value) => !value)}>{mobileSupport ? 'Close hints' : 'Open hints ↗'}</button>}
    <footer className="lesson-footer"><p>{store.saving ? 'Saving your progress…' : store.saveError ? 'Your latest work is waiting to sync.' : 'Progress saves automatically. Python runs in your browser.'}</p></footer>
  </main>
}
