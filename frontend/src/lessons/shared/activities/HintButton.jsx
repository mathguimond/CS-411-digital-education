import { useContext } from 'react'
import { HintContext } from './hintContext.js'
import config from '../../../../../shared/study-config.json'
import { lesson } from '../content.js'

export default function HintButton({ questionId }) {
  const context = useContext(HintContext)
  const question = lesson.questions[questionId]
  if (!context?.enabled || !question) return null
  const limit = config.hintLimits[question.kind] || 0
  if (!limit) return null
  const remaining = Math.max(0, limit - (context.usage[questionId] || 0))
  return <button type="button" className="hint-bulb secondary" disabled={context.busy || !remaining} onClick={() => context.onRequest(questionId)} aria-label={`Hint for: ${question.prompt}`} title={remaining ? `${remaining} hints remaining` : 'All hints used for this question'}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 18h6m-5 3h4M8.5 14.5a6 6 0 1 1 7 0c-1 .8-1.5 1.5-1.5 3.5h-4c0-2-.5-2.7-1.5-3.5Z" /></svg>
  </button>
}
