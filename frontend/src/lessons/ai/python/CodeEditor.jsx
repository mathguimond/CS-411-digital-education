import { useEffect, useState } from 'react'
import usePython from './usePython.js'

export default function CodeEditor({ activity, code, onChange, record, onResult, onBusyChange, assessment = false, locked = false }) {
  const python = usePython()
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { onBusyChange?.(python.busy) }, [python.busy, onBusyChange])

  async function run() {
    if (python.busy) return
    setError('')
    const mode = assessment ? 'run' : 'test'
    record('code_run_started', { activity, mode, code })
    try {
      const next = await python.execute(code, activity, mode)
      setResult(next)
      record('code_run_finished', { activity, mode, result: next })
      onResult?.(next)
    } catch (failure) {
      setError(failure.message)
      record('code_run_failed', { activity, mode, reason: failure.message, failureCode: failure.code || 'cancelled' })
    }
  }

  function indent(event) {
    if (event.key !== 'Tab' || event.shiftKey) return
    event.preventDefault()
    const input = event.target
    const start = input.selectionStart
    onChange(`${code.slice(0, start)}    ${code.slice(input.selectionEnd)}`)
    requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + 4 })
  }

  return <section className="python-editor" aria-label={`${activity} Python editor`}>
    <div className="editor-heading"><label htmlFor={`code-${activity}`}>Your Python code</label><span className="eyebrow">Python · Tab indents; Shift+Tab leaves editor</span></div>
    <textarea id={`code-${activity}`} data-code-activity={activity} className="code-input" spellCheck={false} rows={10} value={code} maxLength={12000} disabled={locked || python.busy} onChange={(event) => { onChange(event.target.value); setResult(null) }} onKeyDown={indent} />
    <div className="code-actions"><button className="secondary" onClick={run} disabled={locked || python.busy || !code.trim()}>{python.status === 'loading' ? 'Loading Python…' : python.busy ? 'Running…' : assessment ? 'Run my code' : 'Run tests'}</button><span className="small muted">{assessment ? 'Only your code runs. Correctness feedback comes after submission.' : 'The first run downloads the Python runtime.'}</span></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {result && <div className="code-results" role="status">
      {result.error && <p className="error-message">{result.error}</p>}
      {result.output && <pre className="program-output">{result.output}</pre>}
      {assessment && !result.error && !result.output && <p className="muted small">Program finished without output. Add your own print(...) statements to try inputs.</p>}
      {!assessment && result.tests.length > 0 && <><ul className="test-results">{result.tests.map((test) => <li key={String(test.input)} className={test.passed ? 'test-passed' : 'test-failed'}><span>{test.passed ? '✓' : '○'} {test.label}</span><span>{test.error || `Expected ${test.expected}; got ${String(test.actual)}`}</span></li>)}</ul>{!result.analysis.recursionUsed && <p className="feedback-note">The activity asks for a recursive solution. Your code does not yet contain a direct recursive call.</p>}{activity === 'memoization' && !result.analysis.dictionaryUsed && <p className="feedback-note">The activity asks for a dictionary to save and reuse results.</p>}{result.efficiency && <p className="feedback-note">For {result.efficiency.label}, your code made {result.efficiency.calls.toLocaleString()} function calls. {result.efficiency.passed ? 'The call-count check passed.' : 'There is still repeated work to investigate.'}</p>}<p className={result.passed ? 'success-message' : 'muted small'}>{result.passed ? 'All practice checks passed.' : 'Use the test results to decide what to change next.'}</p></>}
    </div>}
  </section>
}
