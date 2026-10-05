import { useState } from 'react'
import useStudySession from './useStudySession.js'

export default function LessonWorkspace({ condition, lesson, Support }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [saved, setSaved] = useState(false)
  const { record, download } = useStudySession(condition, lesson.version)
  const step = lesson.steps[stepIndex]

  function saveAnswer(event) {
    event.preventDefault()
    record('answer_saved', { stepId: step.id, answer: answers[step.id] || '' })
    setSaved(true)
  }

  function moveStep(index) {
    record('step_opened', { stepId: lesson.steps[index].id })
    setStepIndex(index)
    setSaved(false)
  }

  return (
    <>
      <header className="lesson-header">
        <span className="brand"><span className="brand-mark" aria-hidden="true">↳</span> RECURSION LAB</span>
        <span className="condition-badge">{condition === 'ai' ? 'AI-assisted learning' : 'Independent learning'}</span>
      </header>
      <main>
        <section className="lesson-intro">
          <p className="eyebrow">A digital education study</p>
          <h1>{lesson.title}<span className="accent">.</span></h1>
          <p className="lead">{lesson.description}</p>
        </section>
        <div className="workspace">
          <section className="lesson-content" aria-labelledby="step-title">
            <p className="eyebrow">Practice · {stepIndex + 1} / {lesson.steps.length}</p>
            <h2 id="step-title">{step.title}</h2>
            <p className="muted">{step.description}</p>
            {step.code && <div className="code-block"><div className="code-label">PYTHON</div><pre><code>{step.code}</code></pre></div>}
            <h3>Think it through</h3>
            <p>{step.question}</p>
            <form onSubmit={saveAnswer}>
              <label htmlFor="answer">Your answer</label>
              <textarea id="answer" rows={4} value={answers[step.id] || ''} onChange={(event) => { setAnswers({ ...answers, [step.id]: event.target.value }); setSaved(false) }} placeholder="Explain your reasoning…" />
              <div className="answer-actions"><button type="submit" disabled={!answers[step.id]?.trim()}>Save answer</button><span role="status" className="muted">{saved ? 'Saved in this session.' : ''}</span></div>
            </form>
            {lesson.steps.length > 1 && <nav className="step-navigation" aria-label="Lesson steps"><button className="secondary" onClick={() => moveStep(stepIndex - 1)} disabled={stepIndex === 0}>Previous</button><button onClick={() => moveStep(stepIndex + 1)} disabled={stepIndex === lesson.steps.length - 1}>Next</button></nav>}
          </section>
          <aside className="support-panel"><Support key={step.id} step={step} record={record} /></aside>
        </div>
        <section className="roadmap" aria-labelledby="roadmap-title"><p className="eyebrow" id="roadmap-title">The learning path ahead</p><ol>{lesson.outline.map((title) => <li key={title}>{title}</li>)}</ol></section>
      </main>
      <footer className="lesson-footer"><p>Practice setup · Session data stays in this tab and resets on refresh.</p><button className="text-button" onClick={download}>Download session record ↓</button></footer>
    </>
  )
}
