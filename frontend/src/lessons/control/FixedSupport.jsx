import { useState } from 'react'

export default function FixedSupport({ step, record }) {
  const [hintCount, setHintCount] = useState(0)
  const [showSolution, setShowSolution] = useState(false)
  const hints = step.hints || []

  function revealHint() {
    record('hint_revealed', { stepId: step.id, hintIndex: hintCount })
    setHintCount(hintCount + 1)
  }

  function revealSolution() {
    record('solution_revealed', { stepId: step.id })
    setShowSolution(true)
  }

  return (
    <>
      <p className="eyebrow">Your learning tools</p><h2>A nudge when you need it</h2>
      <p className="muted">Try the question first. Reveal one hint at a time, then check the worked answer.</p>
      <div className="hint-list" aria-live="polite">{hints.slice(0, hintCount).map((hint, index) => <div className="hint" key={hint}><span className="eyebrow">Hint {index + 1}</span><p>{hint}</p></div>)}</div>
      <button className="secondary full-width" onClick={revealHint} disabled={hintCount >= hints.length}>{hintCount >= hints.length ? 'All hints revealed' : `Reveal hint ${hintCount + 1}`}</button>
      <div className="solution-section">{showSolution ? <div className="hint" role="status"><span className="eyebrow">Worked answer</span><p>{step.solution}</p></div> : <button className="text-button" onClick={revealSolution}>Show worked answer ↗</button>}</div>
    </>
  )
}
