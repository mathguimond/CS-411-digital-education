import NestingDolls from '../visualizations/NestingDolls.jsx'
import CallTree from '../visualizations/CallTree.jsx'
import AnswerField from './AnswerField.jsx'

const example = `def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)`

export default function Introduction({ answers, onChange, record }) {
  return <>
    <p className="activity-lead">A recursive solution asks: <em>can I solve a smaller version of this same problem, then use its result?</em> Explore this idea with nesting dolls.</p>
    <NestingDolls record={record} />
    <div className="concept-cards"><div><span className="eyebrow">01 · Stop</span><h3>The base case</h3><p>A small input you handle directly. The solid doll has nothing smaller inside.</p></div><div><span className="eyebrow">02 · Reduce</span><h3>The recursive case</h3><p>Work on a smaller instance of the same problem, moving toward a base case.</p></div><div><span className="eyebrow">03 · Return</span><h3>The waiting calls</h3><p>Each call keeps its own local state. Smaller results return to waiting calls, which resume their work.</p></div></div>
    <h3>A worked example: Fibonacci</h3><p>The sequence starts 0, 1, 1, 2, 3, 5… Each later number combines the two preceding numbers. The dolls form one chain; Fibonacci branches into two smaller calls.</p><pre className="worked-code">{example}</pre>
    <CallTree record={record} />
    <p>For <code>fib(4)</code>, the original call waits for <code>fib(3)</code> and <code>fib(2)</code>. The stack contains the calls on the active path, rather than every node in the tree at once. Play or step through the returns to watch each waiting call resume.</p>
    <AnswerField id="intro-base" label="Explain the base case using the dolls and Fibonacci." value={answers['intro-base']} onChange={onChange} />
    <AnswerField id="intro-reduction" label="How does each example reduce the problem toward a base case?" value={answers['intro-reduction']} onChange={onChange} />
    <AnswerField id="intro-stack" label="What state does a pending call keep, and how do calls unwind?" value={answers['intro-stack']} onChange={onChange} />
  </>
}
