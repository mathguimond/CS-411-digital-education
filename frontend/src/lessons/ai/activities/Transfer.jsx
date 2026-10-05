import CodeEditor from '../python/CodeEditor.jsx'
import AnswerField from './AnswerField.jsx'

export default function Transfer({ answers, onChange, code, onCode, record, submitted, onBusyChange }) {
  return <>
    <div className="activity-note"><strong>Transfer what you learned.</strong><p>Build your own solution. You may run your code with inputs you choose, but there are no hints or reference answers. Correctness feedback is withheld until you submit.</p></div>
    <section className="activity-section"><h3>Climbing Stairs</h3><p>There are <strong>n stairs</strong>. Each move climbs either <strong>one or two stairs</strong>. How many distinct sequences of moves reach the top?</p><p>For example, for two stairs the sequences are one move of two stairs, or two moves of one stair. For n = 0, there is one way: take no moves. Assume n is a non-negative integer.</p><p>Implement <code>climb_stairs(n)</code> using recursion and a dictionary to avoid repeated computations.</p><CodeEditor activity="transfer" assessment code={code} onChange={onCode} record={record} onBusyChange={onBusyChange} locked={submitted} /></section>
    <section className="activity-section"><h3>Explain your design</h3><AnswerField id="transfer-recurrence" label="What are your base cases and recurrence relation?" value={answers['transfer-recurrence']} onChange={onChange} disabled={submitted} /><AnswerField id="transfer-cache" label="Where do you look up and store cached results, and why?" value={answers['transfer-cache']} onChange={onChange} disabled={submitted} /><AnswerField id="transfer-complexity" label="What are your time and space complexities? Explain your reasoning." value={answers['transfer-complexity']} onChange={onChange} disabled={submitted} /></section>
  </>
}
