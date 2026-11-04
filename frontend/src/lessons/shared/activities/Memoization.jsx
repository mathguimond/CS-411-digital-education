import CallTree from '../visualizations/CallTree.jsx'
import CallTreeBuilder from '../visualizations/CallTreeBuilder.jsx'
import CodeEditor from '../python/CodeEditor.jsx'
import QuestionField from './QuestionField.jsx'

const example = `def fib_memo(n):
    cache = {}

    def solve(k):
        if k in cache:             # Reuse before branching.
            return cache[k]
        if k < 2:
            result = k
        else:
            result = solve(k - 1) + solve(k - 2)
        cache[k] = result          # Save before returning.
        return result

    return solve(n)`

export default function Memoization({ activity, answers, onChange, code, onCode, tree, record, onBusyChange, onResult }) {
  if (activity.id === 'memo-example') return <>
    <p>First study this <strong>worked Fibonacci example</strong>. In the naive fib(5) tree, fib(2) is called three times and fib(3) twice. Identical inputs produce identical results, so these branches repeat work.</p>
    <CallTree input={5} record={record} revealRepeated />
    <h3>Store once, reuse later</h3><pre className="worked-code">{example}</pre>
    <p>The dictionary belongs to one top-level request. Every recursive call shares it. A lookup happens before branching; each newly computed result is stored before returning.</p>
    <CallTree input={5} memoized record={record} revealRepeated />
    <p className="small muted">A cache hit is still a call, but it does not expand another branch. Here, base-case results are cached too. Under unit-cost arithmetic and dictionary access, only O(n) distinct inputs need computing, with O(n) cache and stack space.</p>
    <QuestionField id="memo-example-explanation" answers={answers} onChange={onChange} />
  </>
  if (activity.id === 'stairs-redundancy') return <>
    <p>Now inspect <strong>your own Climbing Stairs (n=4) tree</strong>. Find nodes with identical remaining stairs. Count the total occurrences of one state and how many computations repeat after its first occurrence.</p>
    <CallTreeBuilder tree={tree} record={record} activityId={activity.id} readOnly />
    {['stairs-two-count', 'stairs-extra-count'].map((id) => <QuestionField key={id} id={id} answers={answers} onChange={onChange} />)}
  </>
  return <>
    <p>Your recursive Climbing Stairs code has been copied below. Refactor <code>climb_stairs(n)</code> with a <strong>dictionary cache</strong>. Keep your recurrence and make repeated calls reuse a stored result.</p>
    <CodeEditor activity="memoization" codeKey="memoization" questionId="stairs-memo-code" code={code} onChange={onCode} record={record} onResult={onResult} onBusyChange={onBusyChange} />
    <QuestionField id="stairs-main-change" answers={answers} onChange={onChange} />
  </>
}
