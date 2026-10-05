export default function Pretest({ questions, answers, onChange, submitted }) {
  return <div className="pretest-activity">
    <div className="activity-note"><strong>A starting point, not a grade.</strong><p>Answer from your current knowledge. There are no hints or reference answers during this check. Your answers will be saved when you submit.</p></div>
    {questions.map((question, index) => <fieldset key={question.id} className="pretest-question" disabled={submitted}>
      <legend><span className="eyebrow">Question {index + 1}</span>{question.prompt}</legend>
      <div className="choice-list">{question.options.map((option, optionIndex) => <label key={option} className="pretest-option"><input type="radio" name={question.id} value={optionIndex} checked={answers[question.id] === optionIndex} onChange={() => onChange(question.id, optionIndex)} /><span>{option}</span></label>)}</div>
    </fieldset>)}
    <p className="muted small">Results are withheld until the end so this check does not teach you the answers.</p>
  </div>
}
