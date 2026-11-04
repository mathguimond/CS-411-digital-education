import CodeEditor from '../python/CodeEditor.jsx'
import CallTreeBuilder from '../visualizations/CallTreeBuilder.jsx'
import QuestionField from './QuestionField.jsx'

export default function Transfer({ activity, answers, onChange, code, onCode, tree, onTree, record, onBusyChange }) {
  const optimizing = activity.id === 'grid-optimize'
  return <>
    <div className="activity-note"><strong>Grid Unique Paths</strong><p>Count paths from the top-left cell to the bottom-right cell of a <strong>rows × cols grid of cells</strong>. Move only right or down; there are no obstacles. An empty grid has zero paths; a single-cell grid has one path using no moves. Inputs are non-negative integers.</p><p>The lightbulbs provide the same question-specific hints as the earlier activities.</p></div>
    <svg className="grid-task-diagram" viewBox="0 0 180 125" role="img" aria-label="A two-row, two-column grid, starting at the top left and finishing at the bottom right.">{Array.from({ length: 4 }, (_, i) => <rect key={i} x={20 + i % 2 * 62} y={10 + Math.floor(i / 2) * 48} width="60" height="46" rx="4" className={i === 0 || i === 3 ? 'endpoint' : ''} />)}<text x="50" y="37" textAnchor="middle">Start</text><text x="112" y="85" textAnchor="middle">Finish</text></svg>
    {activity.id === 'grid-components' ? <><p>Select your approach before opening the editor.</p>{activity.fields.map((id) => <QuestionField id={id} key={id} answers={answers} onChange={onChange} />)}</> : <>
      <p>{optimizing ? 'Your code from Build and trace has been copied below. Inspect the saved small tree, then add a dictionary cache to avoid repeated work on larger grids. A 2 × 2 trace may have no repeated states when you use direct one-axis base cases; the larger tests expose the repeated work.' : 'Construct the naive tree for unique_paths(2, 2), then implement the recurrence without memoization. Run the tests to inspect your outputs. Your tree does not block continuing.'}</p>
      <CallTreeBuilder tree={tree} onChange={onTree} record={record} activityId={activity.id} questionId="grid-tree" readOnly={optimizing} />
      <CodeEditor activity={activity.runner} codeKey={activity.code} questionId={optimizing ? 'grid-memo-code' : 'grid-code'} code={code} onChange={onCode} record={record} onBusyChange={onBusyChange} />
    </>}
  </>
}
