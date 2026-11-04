import CodeEditor from '../python/CodeEditor.jsx'
import CallTreeBuilder from '../visualizations/CallTreeBuilder.jsx'
import QuestionField from './QuestionField.jsx'

export default function Practice({ answers, onChange, code, onCode, tree, onTree, record, onBusyChange }) {
  return <>
    <p>You have <strong>n stairs</strong> to climb. Each move climbs either <strong>one or two stairs</strong>. Count distinct sequences of moves that reach the top; for zero stairs, count the empty sequence as one way.</p>
    <p>Start by constructing the naive call tree for <strong>climb_stairs(4)</strong>, then implement the function. Your tree is saved, but its completeness does not block the next activity.</p>
    <CallTreeBuilder tree={tree} onChange={onTree} record={record} activityId="stairs-build" questionId="stairs-tree" />
    <QuestionField id="stairs-suitability" answers={answers} onChange={onChange} />
    <QuestionField id="stairs-recurrence" answers={answers} onChange={onChange} />
    <CodeEditor activity="stairs" codeKey="stairs" questionId="stairs-code" code={code} onChange={onCode} record={record} onBusyChange={onBusyChange} />
    <QuestionField id="stairs-depth" answers={answers} onChange={onChange} />
  </>
}
