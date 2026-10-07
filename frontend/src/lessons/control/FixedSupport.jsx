import { support } from './content.js'
import CallTree from '../shared/visualizations/CallTree.jsx'

export default function FixedSupport({ step, activity, session, setSession, record }) {
  const cards = support.activities[activity.id]
  if (!cards) return null
  const progress = session.fixedSupport?.[activity.id] || { hintCount: 0, solutionRevealed: false }
  const { hintCount, solutionRevealed } = progress
  const allHintsRevealed = hintCount >= cards.hints.length

  function revealHint() {
    if (allHintsRevealed) return
    record('hint_revealed', { activityId: activity.id, stepId: step.id, hintIndex: hintCount, tier: hintCount + 1, supportVersion: support.version })
    setSession((value) => ({ ...value, fixedSupport: { ...value.fixedSupport, [activity.id]: { ...progress, hintCount: hintCount + 1 } } }))
  }
  function revealSolution() {
    if (!allHintsRevealed || solutionRevealed) return
    record('solution_revealed', { activityId: activity.id, stepId: step.id, supportVersion: support.version })
    setSession((value) => ({ ...value, fixedSupport: { ...value.fixedSupport, [activity.id]: { ...progress, solutionRevealed: true } } }))
  }

  return <>
    <p className="eyebrow">Help with your current activity</p><h2>A next step, when you need it.</h2>
    <p className="muted">Try the activity first. Reveal one prepared hint at a time, then compare your work with the worked answer if you still need help.</p>
    <p className="small current-hint-activity"><strong>{activity.title}</strong></p>
    <div className="fixed-hint-list" aria-live="polite">{cards.hints.slice(0, hintCount).map((hint, index) => <div className="hint" key={index}><span className="eyebrow">Hint {index + 1}</span><p>{hint}</p></div>)}</div>
    <button className="secondary full-width" onClick={revealHint} disabled={allHintsRevealed}>{allHintsRevealed ? 'All hints revealed' : `Reveal hint ${hintCount + 1}`}</button>
    <div className="solution-section">{solutionRevealed ? <div className="fixed-worked-answer">
      <p className="eyebrow" role="status">Worked answer</p>
      {cards.solution.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {cards.solution.code && <pre className="worked-code"><code>{cards.solution.code}</code></pre>}
      {cards.solution.tree && <CallTree variant={cards.solution.tree.variant} input={cards.solution.tree.input} record={record} fullyRevealed />}
    </div> : <button className="text-button" onClick={revealSolution} disabled={!allHintsRevealed}>Show worked answer ↗</button>}</div>
    {!allHintsRevealed && <p className="small muted">The worked answer becomes available after both hints.</p>}
  </>
}
