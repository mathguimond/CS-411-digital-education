import CodeEditor from '../python/CodeEditor.jsx'
import CallTreeBuilder from '../visualizations/CallTreeBuilder.jsx'
import AnswerField from './AnswerField.jsx'

export default function Transfer({ activity, answers, onChange, code, onCode, tree, onTree, record, onBusyChange, onResult, submitted }) {
  return <fieldset className="transfer-work" disabled={submitted} aria-label="Transfer assessment work">
    <div className="activity-note"><strong>Grid Unique Paths · Independent assessment</strong><p>Count paths from the top-left cell to the bottom-right cell of a <strong>rows × cols grid of cells</strong>. Moves go only right or down; there are no obstacles. An empty grid has zero paths; a single-cell grid has one path using no moves. Inputs are non-negative integers.</p><p>There is no AI support, hint, reference solution, or tree check during this assessment.</p></div>
    <svg className="grid-task-diagram" viewBox="0 0 240 170" role="img" aria-label="A three-row, three-column grid. Start at the top-left cell and finish at the bottom-right cell. Allowed moves: right or down.">
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={20 + i % 3 * 62} y={10 + Math.floor(i / 3) * 48} width="60" height="46" rx="4" className={i === 0 || i === 8 ? 'endpoint' : ''} />)}
      <text x="50" y="37" textAnchor="middle">Start</text><text x="174" y="133" textAnchor="middle">Finish</text>
    </svg>
    {activity.id === 'grid-components' ? <>
      <p>Describe your approach before executing code. Submit these responses to unlock the editor.</p>
      <AnswerField id="grid-base" label="What base conditions will your recursive function use?" value={answers['grid-base']} onChange={onChange} />
      <AnswerField id="grid-reduction" label="How will you reduce this problem into smaller instances and combine their results?" value={answers['grid-reduction']} onChange={onChange} />
      <AnswerField id="grid-stack" label="What remains pending on the stack while a smaller call executes?" value={answers['grid-stack']} onChange={onChange} />
    </> : <>
      <p>{activity.id === 'grid-build' ? 'Implement your recurrence in unique_paths(rows, cols) without memoization first. Construct the full naive tree for a 3 × 3 grid using your chosen base conditions.' : 'Identify overlapping subproblems in your saved tree, then refactor your own code using a dictionary cache. Keep the function named unique_paths(rows, cols). Explain the time and memory bounds in terms of both dimensions.'}</p>
      <CodeEditor activity="transfer" code={code} onChange={onCode} record={record} onResult={onResult} onBusyChange={onBusyChange} assessment locked={submitted} />
      <CallTreeBuilder tree={tree} onChange={onTree} record={record} activityId={activity.id} assessment readOnly={activity.id === 'grid-optimize'} />
      {activity.id === 'grid-build' ? <>
        <AnswerField id="grid-recurrence" label="State the recurrence implemented in your function." value={answers['grid-recurrence']} onChange={onChange} />
        <AnswerField id="grid-depth" label="What is the maximum stack depth in your 3 × 3 tree? Count the original call as one frame." value={answers['grid-depth']} onChange={onChange} />
      </> : <>
        <AnswerField id="grid-overlap" label="Identify a repeated state in your tree and explain the redundant work." value={answers['grid-overlap']} onChange={onChange} />
        <AnswerField id="grid-cache" label="Explain your cache key, lookup, and storage." value={answers['grid-cache']} onChange={onChange} />
        <AnswerField id="grid-complexity" label="Explain runtime, cache space, and maximum stack space using rows and cols." value={answers['grid-complexity']} onChange={onChange} />
      </>}
    </>}
    <p className="muted small">Your own code runs are allowed after the first responses are submitted. Correctness checks are revealed only after final submission. Starting this assessment closes earlier assisted activities.</p>
  </fieldset>
}
