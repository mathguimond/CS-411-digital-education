import QuestionField from './QuestionField.jsx'

export default function Reflection({ answers, onChange, condition }) {
  return <><p>The timed lesson is finished. Please answer these final questions about your experience.</p><QuestionField id="hint-helpfulness" answers={answers} onChange={onChange} /><QuestionField id="lesson-experience" answers={answers} onChange={onChange} promptOverride={`How did you feel going through this lesson using ${condition === 'ai' ? 'AI-assisted hints' : 'pre-set hints'}?`} /><QuestionField id="recursion-after" answers={answers} onChange={onChange} /></>
}
