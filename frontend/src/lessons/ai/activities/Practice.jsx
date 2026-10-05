import { useState } from 'react'
import CodeEditor from '../python/CodeEditor.jsx'
import CallTree from '../visualizations/CallTree.jsx'
import AnswerField from './AnswerField.jsx'

export default function Practice({ problems, answers, onChange, code, onCode, record, onBusyChange }) {
  const [feedback, setFeedback] = useState('')
  const [treeVisible, setTreeVisible] = useState(false)

  function checkSuitability() {
    const correct = answers.suitability === 'fibonacci'
    record('suitability_checked', { correct, answer: answers.suitability })
    setFeedback(correct ? 'Yes. The number you want can be described using two smaller instances of the same problem. Recursion is suitable here, although an iterative solution is possible too.' : 'Think about which problem depends on two smaller instances of itself. A single pass or a fixed formula is usually simpler for the other choices.')
  }

  return <>
    <section className="activity-section"><p className="eyebrow">Activity 1 · Identify the structure</p><h3>Which problem naturally branches into smaller copies?</h3><div className="problem-choices">{problems.map((problem) => <label className={`problem-choice ${answers.suitability === problem.id ? 'selected' : ''}`} key={problem.id}><input type="radio" name="suitability" checked={answers.suitability === problem.id} onChange={() => { onChange('suitability', problem.id); setFeedback('') }} /><span><strong>{problem.title}</strong><span>{problem.description}</span></span></label>)}</div><AnswerField id="suitability-reason" label="Why is your choice suitable? Name the smaller subproblems." value={answers['suitability-reason']} onChange={onChange} /><button className="secondary" onClick={checkSuitability} disabled={!answers.suitability}>Check my choice</button>{feedback && <p className="feedback-note" role="status">{feedback}</p>}</section>
    <section className="activity-section"><p className="eyebrow">Activity 2 · Design the function</p><h3>Write Fibonacci recursively</h3><p>The sequence begins with <code>fib(0) = 0</code> and <code>fib(1) = 1</code>. For larger inputs, each number is the sum of the two previous numbers. Assume n is a non-negative integer.</p><AnswerField id="fib-recurrence" label="Write the recurrence relation and explain the base cases." value={answers['fib-recurrence']} onChange={onChange} /><CodeEditor activity="fibonacci" code={code} onChange={onCode} record={record} onBusyChange={onBusyChange} /><p className="muted small">Use the tutor for a targeted hint. It will help you reason through the function without writing the solution.</p></section>
    <section className="activity-section"><p className="eyebrow">Activity 3 · Predict, then trace</p><h3>Follow fib(4)</h3><p>Before you play the trace, predict the return value and how many call frames will be on the stack at its deepest point. Count the original call as one frame.</p><div className="prediction-fields"><div><label htmlFor="fib-prediction">Return value</label><input id="fib-prediction" type="number" min="0" value={answers['fib-prediction'] ?? ''} onChange={(event) => onChange('fib-prediction', event.target.value)} /></div><div><label htmlFor="stack-prediction">Maximum stack depth</label><input id="stack-prediction" type="number" min="1" value={answers['stack-prediction'] ?? ''} onChange={(event) => onChange('stack-prediction', event.target.value)} /></div></div><button className="secondary" onClick={() => { setTreeVisible(true); record('trace_revealed', { prediction: answers['fib-prediction'], stackPrediction: answers['stack-prediction'] }) }} disabled={treeVisible || !String(answers['fib-prediction'] ?? '').trim() || !String(answers['stack-prediction'] ?? '').trim()}>Explore the call tree</button>{treeVisible && <CallTree record={record} />}<AnswerField id="trace-explanation" label="Describe one call that waits, then resumes when a smaller call returns." value={answers['trace-explanation']} onChange={onChange} /></section>
  </>
}
