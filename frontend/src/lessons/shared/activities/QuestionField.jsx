import { lesson } from '../content.js'
import HintButton from './HintButton.jsx'

export default function QuestionField({ id, question = lesson.questions[id], answers, onChange, promptOverride, disabled = false }) {
  const prompt = promptOverride || question.prompt, value = answers[question.id]
  if (question.kind === 'choice') return <fieldset className="question-field choice-question" disabled={disabled}>
    <legend><span>{prompt}</span><HintButton questionId={question.id} /></legend>
    <div className="choice-list">{question.options.map((option) => <label className="pretest-option" key={option.id}><input type="radio" name={question.id} value={option.id} checked={value === option.id} onChange={() => onChange(question.id, option.id)} /><span>{option.label}</span></label>)}</div>
    {question.followUp && value === question.followUp.when && <div className="answer-field"><label htmlFor={question.followUp.id}>{question.followUp.prompt}</label><input id={question.followUp.id} type="text" maxLength={240} value={answers[question.followUp.id] || ''} onChange={(event) => onChange(question.followUp.id, event.target.value)} /></div>}
  </fieldset>
  if (question.kind === 'scale') return <div className="question-field rating-question"><label htmlFor={question.id}>{prompt}</label><div className="rating-labels"><span>0 · Not helpful</span><output htmlFor={question.id}>{value ?? 'Choose a score'}</output><span>10 · Very helpful</span></div><input id={question.id} type="range" min={question.minimum} max={question.maximum} step="1" value={value ?? 5} disabled={disabled} onChange={(event) => onChange(question.id, Number(event.target.value))} onPointerUp={(event) => onChange(question.id, Number(event.currentTarget.value))} /></div>
  return <div className="question-field answer-field"><div className="question-heading"><label htmlFor={question.id}>{prompt}</label><HintButton questionId={question.id} /></div><textarea id={question.id} rows={2} maxLength={4000} value={value || ''} onChange={(event) => onChange(question.id, event.target.value)} disabled={disabled} placeholder="Your reasoning…" /></div>
}
