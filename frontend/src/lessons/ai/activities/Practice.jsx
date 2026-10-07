import CodeEditor from '../python/CodeEditor.jsx'
import CallTreeBuilder from '../visualizations/CallTreeBuilder.jsx'
import AnswerField from './AnswerField.jsx'

export default function Practice({ activity, answers, onChange, code, onCode, tree, onTree, record, onBusyChange, onResult }) {
  if (activity.id === 'stairs-design') return <>
    <p>You have <strong>n stairs</strong> to climb. Each move climbs either <strong>one or two stairs</strong>. Count distinct sequences of moves that reach the top. Assume a non-negative integer n; for zero stairs, count the empty sequence as one way.</p>
    <p>For example, two stairs can be climbed with [1, 1] or [2]. Use the Fibonacci example to design your own recursive solution without a cache yet.</p>
    <AnswerField id="stairs-suitability" label="Why is recursion suitable? Identify smaller instances of the same problem." value={answers['stairs-suitability']} onChange={onChange} />
    <AnswerField id="stairs-recurrence" label="State your recurrence and base cases." value={answers['stairs-recurrence']} onChange={onChange} />
    <CodeEditor activity="stairs" code={code} onChange={onCode} record={record} onResult={onResult} onBusyChange={onBusyChange} />
  </>
  return <>
    <p>Construct the <strong>full naive call tree for climb_stairs(5)</strong> using the base cases in your function. Each node records its remaining stairs and returned count. Add the recursive child calls and arrange them by dragging.</p>
    <details className="concept-recap"><summary>View your submitted recursive code</summary><pre className="worked-code">{code}</pre></details>
    <CallTreeBuilder tree={tree} onChange={onTree} record={record} activityId={activity.id} />
    <AnswerField id="stairs-depth" label="What is the maximum number of simultaneous stack frames in your tree? Count the root as one." value={answers['stairs-depth']} onChange={onChange} rows={2} />
    <AnswerField id="stairs-stack" label="Describe the state of one waiting call and how its children’s results let it resume. How does branching affect the number of calls?" value={answers['stairs-stack']} onChange={onChange} />
  </>
}
