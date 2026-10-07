import CallTree from '../visualizations/CallTree.jsx'
import CallTreeBuilder from '../visualizations/CallTreeBuilder.jsx'
import CodeEditor from '../python/CodeEditor.jsx'
import AnswerField from './AnswerField.jsx'

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
    <AnswerField id="memo-example-explanation" label="Explain how the lookup and storage order avoids repeating a Fibonacci branch." value={answers['memo-example-explanation']} onChange={onChange} />
  </>
  if (activity.id === 'stairs-redundancy') return <>
    <p>Now inspect <strong>your own Climbing Stairs tree</strong>. Find nodes with identical remaining stairs. Count the total occurrences of one state and how many computations repeat after its first occurrence.</p>
    <CallTreeBuilder tree={tree} record={record} activityId={activity.id} readOnly />
    <AnswerField id="stairs-two-count" label="How many times does climb_stairs(2) occur in your tree?" value={answers['stairs-two-count']} onChange={onChange} rows={2} />
    <AnswerField id="stairs-extra-count" label="How many of those occurrences repeat work after the first computation?" value={answers['stairs-extra-count']} onChange={onChange} rows={2} />
    <AnswerField id="stairs-redundancy" label="Locate another repeated state. Explain the wasted work and why its result can be reused." value={answers['stairs-redundancy']} onChange={onChange} />
  </>
  return <>
    <p>Your recursive Climbing Stairs code has been copied below. Refactor <code>climb_stairs(n)</code> with a <strong>dictionary cache</strong>. Keep your recurrence and make repeated calls reuse a stored result.</p>
    <CodeEditor activity="memoization" code={code} onChange={onCode} record={record} onResult={onResult} onBusyChange={onBusyChange} />
    <AnswerField id="stairs-cache" label="What identifies a cached state? Explain where lookup and storage happen." value={answers['stairs-cache']} onChange={onChange} />
    <AnswerField id="stairs-complexity" label="Compare naive and memoized runtime growth, and explain cache and stack memory use." value={answers['stairs-complexity']} onChange={onChange} />
  </>
}
