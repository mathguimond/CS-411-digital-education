import QuestionField from './QuestionField.jsx'

export default function Pretest({ questions, answers, onChange }) {
  return <div className="pretest-activity"><div className="activity-note"><strong>Your starting point.</strong><p>Answer from your current knowledge. You can select “I don’t know” for the diagnostic questions. The lesson timer starts after you submit this pre-test.</p></div>{questions.map((question) => <QuestionField key={question.id} question={question} answers={answers} onChange={onChange} />)}</div>
}
