import { useEffect, useRef, useState } from 'react'
import AiTutor from './AiTutor.jsx'
import { lesson } from './content.js'
import Pretest from './activities/Pretest.jsx'
import Introduction from './activities/Introduction.jsx'
import Practice from './activities/Practice.jsx'
import Memoization from './activities/Memoization.jsx'
import Transfer from './activities/Transfer.jsx'
import { ACTIVITIES, canVisitActivity } from './activities/activityPlan.js'
import useLessonStudy from './study/useLessonStudy.js'
import { canVisitPart, cohortFlags, currentActivity, learnerContext, scorePretest, studyMetrics } from './study/lessonState.js'
import { assessCallTree, treeIsFilled } from './visualizations/treeModel.js'
import usePython from './python/usePython.js'
import './AiLesson.css'

function AssessmentResults({ session, download }) {
  const result = session.assessment, metrics = studyMetrics(session)
  const total = result.totalTests ?? 11
  const detected = (value) => value === true ? 'yes' : value === false ? 'no' : 'not assessed'
  return <div className="lesson-results">
    <p className="eyebrow">Lesson complete</p><h2 id="part-heading" tabIndex={-1}>You made the jump.</h2>
    <p>You have practiced recognizing smaller problems, tracing pending calls, and remembering results to avoid repeated work.</p>
    <div className="comparison-stats"><div><strong>{session.baseline.score}/{session.baseline.total}</strong><span>Pre-test questions correct</span></div><div><strong>{result.tests.filter((test) => test.passed).length}/{total}</strong><span>Transfer tests passed</span></div><div><strong>{metrics.hintRequests}</strong><span>Hint requests</span></div></div>
    <h3>Your Grid Unique Paths assessment</h3>
    {result.error && <p className="error-message">{result.error}</p>}
    <ul className="assessment-checks"><li>Correct outputs: {!result.error && result.tests.length === total && result.tests.every((test) => test.passed) ? 'all checks passed' : 'some checks need attention'}</li><li>Recursive call detected: {detected(result.analysis.recursionUsed)}</li><li>Dictionary detected: {detected(result.analysis.dictionaryUsed)}</li><li>Call-count check: {result.efficiency ? result.efficiency.passed ? 'passed' : 'needs attention' : 'not assessed'}</li><li>Constructed call tree: {result.treeAssessment.passed ? 'passed' : 'needs attention'}</li></ul>
    <p className="small muted">These checks assess outputs, code structure, call counts, and your recorded tree. Written explanations and agreement between your tree and code need organizer review. The call-count check alone does not prove a complexity bound.</p>
    <details className="concept-recap"><summary>View submitted test results</summary><ul className="test-results">{result.tests.map((test) => <li key={String(test.input)}><span>{test.label}</span><span>{test.error || `Expected ${test.expected}; got ${String(test.actual)}`}</span></li>)}</ul></details>
    <details className="concept-recap"><summary>View tree feedback</summary>{result.treeAssessment.passed ? <p>Your recorded recursive branches and returned values passed the tree checks.</p> : <ul>{result.treeAssessment.issues.map((issue, i) => <li key={i}>Call {session.trees.grid.nodes.findIndex((node) => node.id === issue.nodeId) + 1}: {issue.message}</li>)}</ul>}</details>
    <button onClick={download}>Download my lesson record</button><p className="muted small">Share the downloaded record with your organizer when asked. This pilot does not upload results automatically.</p>
  </div>
}

export default function AiLesson() {
  const { session, setSession, record, answer, code, download } = useLessonStudy(lesson.version)
  const [mobileTutor, setMobileTutor] = useState(false)
  const [editorBusy, setEditorBusy] = useState(false)
  const [hintBusy, setHintBusy] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const python = usePython(), heading = useRef(null), lastActivity = useRef(null)
  const index = session.partIndex, part = lesson.parts[index], activity = currentActivity(session)
  const position = session.activityIndexByPart[index] || 0
  const complete = session.transferSubmitted, tutorAllowed = part.ai_allowed !== false && !complete
  const busy = editorBusy || hintBusy || python.busy
  const fieldsComplete = index === 0 ? lesson.pretest.every((question) => Number.isInteger(session.answers[question.id])) : activity.fields.every((id) => String(session.answers[id] ?? '').trim())
  const treeComplete = !activity.tree || treeIsFilled(session.trees[activity.tree])
  const runComplete = !activity.run || session.events.some((event) => event.activityId === activity.id && (event.type === 'code_run_finished' || event.type === 'code_run_failed' && event.failureCode === 'execution_timeout'))
  const ready = fieldsComplete && treeComplete && runComplete
  const lastInPart = position === ACTIVITIES[index].length - 1

  useEffect(() => {
    if (lastActivity.current === activity.id || complete) return
    lastActivity.current = activity.id
    record('activity_entered', { partId: part.id, activityId: activity.id })
  }, [activity.id, part.id, record, complete])

  function focusHeading() {
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) })
  }
  function visit(next, nextActivity) {
    if (busy || complete || !canVisitPart(session, next)) return
    if (nextActivity !== undefined && (!canVisitActivity(session, next, nextActivity) || index === 4 && nextActivity < position)) return
    setSession((value) => ({ ...value, partIndex: next, activityIndexByPart: nextActivity === undefined ? value.activityIndexByPart : { ...value.activityIndexByPart, [next]: nextActivity } }))
    setSubmissionError(''); focusHeading()
  }
  function submittedAttempt() {
    return { partId: part.id, activityId: activity.id, answers: Object.fromEntries((index === 0 ? lesson.pretest.map((question) => question.id) : activity.fields).map((id) => [id, session.answers[id]])),
      code: activity.code ? session.code[activity.code] : undefined, tree: activity.tree ? session.trees[activity.tree] : undefined }
  }
  function advance() {
    if (!ready || busy) return
    record('activity_submitted', submittedAttempt())
    setSession((value) => ({ ...value, completedActivities: [...new Set([...value.completedActivities, activity.id])],
      completedParts: lastInPart ? [...new Set([...value.completedParts, index])].sort() : value.completedParts,
      partIndex: lastInPart ? index + 1 : index,
      activityIndexByPart: lastInPart ? value.activityIndexByPart : { ...value.activityIndexByPart, [index]: position + 1 },
      ...(index === 0 ? { pretestSubmitted: true, baseline: scorePretest(lesson.pretest, value.answers), cohortFlags: cohortFlags(lesson.pretest, value.answers) } : {}),
      ...(index === 2 && lastInPart && !value.completedParts.includes(2) ? { code: { ...value.code, memoization: value.code.stairs } } : {}),
      ...(index === 3 && lastInPart ? { transferStarted: true } : {}),
    }))
    focusHeading()
  }
  async function submitTransfer() {
    if (!ready || busy || complete) return
    setSubmissionError(''); record('activity_submitted', submittedAttempt())
    record('transfer_submission_started', { code: session.code.transfer, tree: session.trees.grid, answers: Object.fromEntries(ACTIVITIES[4].flatMap((item) => item.fields).map((id) => [id, session.answers[id]])) })
    let assessment
    try { assessment = await python.execute(session.code.transfer, 'transfer', 'test') } catch (failure) {
      if (failure.code !== 'execution_timeout') {
        setSubmissionError('Assessment could not run. Your work is saved; please try submitting again. ' + failure.message)
        record('assessment_unavailable', { reason: failure.message }); return
      }
      assessment = { tests: [], totalTests: 11, error: 'The submitted program exceeded the execution time limit.', analysis: {}, passed: false }
    }
    assessment.treeAssessment = assessCallTree(session.trees.grid)
    record('transfer_submitted', { result: assessment })
    setSession((value) => ({ ...value, assessment, transferSubmitted: true, completedAt: new Date().toISOString(), completedParts: [0, 1, 2, 3, 4], completedActivities: [...new Set([...value.completedActivities, activity.id])] }))
    requestAnimationFrame(() => document.getElementById('part-heading')?.focus())
  }
  const common = { activity, answers: session.answers, onChange: answer, record, onBusyChange: setEditorBusy }
  const treeChange = (kind) => (tree) => setSession((value) => ({ ...value, trees: { ...value.trees, [kind]: tree } }))
  const actionLabel = index === 0 ? 'Submit pre-test & continue' : index === 4 && lastInPart ? python.busy ? 'Assessing your submission…' : 'Submit final assessment' : index === 3 && lastInPart ? 'Start the transfer task' : lastInPart ? 'Submit attempt & continue' : 'Submit attempt & unlock next activity'
  return <main className="ai-lesson">
    <header className="lesson-header"><div className="brand"><span className="brand-mark" aria-hidden="true">↳</span>DYNAMIC LEARNING</div><span className="condition-badge">AI-assisted lesson · About 30 minutes</span></header>
    <div className="lesson-intro"><p className="eyebrow">Recursion → Memoization</p><h1>Thinking <span className="accent">recursively.</span></h1><p className="lead">Recognize the pattern. Build the solution. Make it faster.</p></div>
    <nav className="lesson-progress" aria-label="Lesson parts"><ol>{lesson.parts.map((item, p) => <li key={item.id}><button className={`progress-part ${p === index ? 'current' : ''} ${session.completedParts.includes(p) ? 'done' : ''}`} aria-current={p === index ? 'step' : undefined} disabled={busy || complete || !canVisitPart(session, p)} onClick={() => visit(p)}><span className="part-number">{session.completedParts.includes(p) ? '✓' : `0${p + 1}`}</span><span>{item.label}</span></button></li>)}</ol></nav>
    <div className={`workspace ${tutorAllowed ? '' : 'without-tutor'}`}>
      <section className="lesson-content" aria-labelledby="part-heading">
        {complete ? <AssessmentResults session={session} download={download} /> : <>
          <p className="eyebrow part-kicker">Part {index + 1} of 5 · {part.label}</p><h2 id="part-heading" tabIndex={-1} ref={heading}>{part.title}</h2>
          {ACTIVITIES[index].length > 1 && <nav className="activity-progress" aria-label="Activities in this part">{ACTIVITIES[index].map((item, i) => <button key={item.id} className={`secondary ${i === position ? 'current' : ''}`} aria-current={i === position ? 'step' : undefined} disabled={busy || !canVisitActivity(session, index, i) || index === 4 && i < position} onClick={() => visit(index, i)}>{session.completedActivities.includes(item.id) ? '✓' : i + 1} · {item.title}</button>)}</nav>}
          <h3 className="activity-title">{activity.title}</h3>
          <div key={activity.id}>
            {index === 0 && <Pretest questions={lesson.pretest} {...common} submitted={session.pretestSubmitted} />}
            {index === 1 && <Introduction {...common} />}
            {index === 2 && <Practice {...common} code={session.code.stairs} onCode={(source) => code('stairs', source)} tree={session.trees.stairs} onTree={treeChange('stairs')} />}
            {index === 3 && <Memoization {...common} code={session.code.memoization} onCode={(source) => code('memoization', source)} tree={session.trees.stairs} />}
            {index === 4 && <Transfer {...common} code={session.code.transfer} onCode={(source) => code('transfer', source)} tree={session.trees.grid} onTree={treeChange('grid')} submitted={python.busy} />}
          </div>
          <div className="part-actions"><button onClick={index === 4 && lastInPart ? submitTransfer : advance} disabled={!ready || busy}>{actionLabel}</button><p className="small muted">{!fieldsComplete ? 'Complete each response to submit your attempt.' : !treeComplete ? 'Enter inputs and return values for your tree, including at least two child calls. Correctness is not required to continue.' : !runComplete ? 'Run your code at least once before continuing. It does not have to pass.' : index === 0 ? 'Submission locks your pre-test. Results appear at the end.' : index === 3 && lastInPart ? 'Starting the transfer task closes the earlier assisted activities.' : index === 4 && lastInPart ? 'Submission locks your work and reveals the assessment.' : 'Submitting your attempt unlocks the next activity, even if it contains mistakes.'}</p></div>
          {submissionError && <p className="error-message" role="alert">{submissionError}</p>}
        </>}
      </section>
      {tutorAllowed && <aside id="lesson-tutor" className={`support-panel ai-support ${mobileTutor ? 'mobile-open' : ''}`} aria-label="AI hints"><button className="secondary mobile-tutor-close" onClick={() => setMobileTutor(false)}>Close hints</button><AiTutor key={activity.id} step={part} activity={activity} record={record} learnerContext={learnerContext(session, activity)} conversation={session.chatHistory} unlocked={session.hintUnlockedActivities.includes(activity.id)} onUnlock={() => setSession((value) => ({ ...value, hintUnlockedActivities: [...new Set([...value.hintUnlockedActivities, activity.id])] }))} onConversationChange={(messages) => setSession((value) => ({ ...value, chatHistory: messages }))} onBusyChange={setHintBusy} /></aside>}
    </div>
    {tutorAllowed && <button className="mobile-tutor-toggle" aria-controls="lesson-tutor" aria-expanded={mobileTutor} onClick={() => setMobileTutor((value) => !value)}>{mobileTutor ? 'Close hints' : 'Open AI hints ↗'}</button>}
    <footer className="lesson-footer"><p>Progress is saved in this browser tab. Python runs in your browser.</p><button className="text-button" onClick={download}>Download session record ↓</button></footer>
  </main>
}
