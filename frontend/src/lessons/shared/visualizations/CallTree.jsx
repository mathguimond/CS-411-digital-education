import { useMemo, useState } from 'react'
import { describeTraceEvent, fibonacciTrace, stairsTrace, treeLayout } from './recursionModel.js'
import usePlayback from './usePlayback.js'

export default function CallTree({ input = 4, variant = 'fibonacci', memoized = false, record, revealRepeated = false, fullyRevealed = false }) {
  const functionName = variant === 'stairs' ? 'climb_stairs' : 'fib'
  const nodeLabel = variant === 'stairs' ? 'ways' : 'fib'
  const subject = variant === 'stairs' ? 'Climbing Stairs' : 'Fibonacci'
  const trace = useMemo(() => (variant === 'stairs' ? stairsTrace : fibonacciTrace)(input, { memoized }), [input, memoized, variant])
  const layout = useMemo(() => treeLayout(trace.nodes), [trace])
  const playback = usePlayback(trace.events.length, 800)
  const [selectedN, setSelectedN] = useState(revealRepeated ? 2 : null)
  const event = trace.events[playback.index]
  const visibleEvents = trace.events.slice(0, playback.index + 1)
  const entered = new Set(visibleEvents.filter((entry) => entry.type === 'enter').map((entry) => entry.nodeId))
  const returned = new Set(visibleEvents.filter((entry) => entry.type === 'return').map((entry) => entry.nodeId))
  const values = Object.fromEntries((fullyRevealed ? trace.events : visibleEvents).filter((entry) => entry.value !== null).map((entry) => [entry.nodeId, entry.value]))

  function selectNode(n) { setSelectedN(selectedN === n ? null : n); record('tree_node_selected', { input: n, memoized }) }

  return <section className="interactive-figure call-tree-figure" aria-label={`${memoized ? 'Memoized' : 'Naive'} ${subject} call tree`}>
    <div className="figure-heading"><span className="eyebrow">{memoized ? 'Reuse a cached result' : 'Follow each call'} · {functionName}({input})</span><span className="figure-counter">{playback.index + 1} / {trace.events.length}</span></div>
    <div className="tree-scroll"><svg viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ minWidth: layout.width }} role="group" aria-label={`${subject} call tree. Click a node to highlight calls with the same input.`}>
      {trace.nodes.filter((node) => node.parentId).map((node) => {
        const start = layout.positions[node.parentId], end = layout.positions[node.id]
        return <path key={node.id} d={`M ${start.x} ${start.y + 20} C ${start.x} ${start.y + 55}, ${end.x} ${end.y - 45}, ${end.x} ${end.y - 20}`} className={`tree-edge ${entered.has(node.id) ? 'visited' : ''}`} />
      })}
      {trace.nodes.map((node) => {
        const point = layout.positions[node.id]
        const className = ['tree-node', entered.has(node.id) ? 'visited' : '', returned.has(node.id) ? 'returned' : '', event.nodeId === node.id ? 'active' : '', selectedN === node.n ? 'highlighted' : '', node.cached && entered.has(node.id) ? 'cache-hit' : ''].join(' ')
        return <g key={node.id} transform={`translate(${point.x}, ${point.y})`} className={className} role="button" tabIndex={0} aria-label={`Highlight ${functionName}(${node.n}) calls`} onClick={() => selectNode(node.n)} onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); selectNode(node.n) } }}>
          <rect x="-31" y="-19" width="62" height="38" rx="10" /><text textAnchor="middle" y="4">{nodeLabel}({node.n})</text>{values[node.id] !== undefined && <text className="node-result" textAnchor="middle" y="34">→ {values[node.id]}{node.cached ? ' · cache' : ''}</text>}
        </g>
      })}
    </svg></div>
    <p className="animation-caption" role="status">{describeTraceEvent(event, functionName)}</p>
    {fullyRevealed && <p className="small muted">Reference return values are shown throughout. The colors and stack follow the current animation step.</p>}
    <div className="trace-details"><div><span className="eyebrow">Stack · {event.stack.length} frames</span><ol className="stack-frames">{[...event.stack].reverse().map((entry) => <li key={entry.nodeId}>{functionName}({entry.n})</li>)}{event.stack.length === 0 && <li>Empty</li>}</ol></div>{memoized && <div><span className="eyebrow">Cache</span><div className="cache-values">{Object.entries(event.cache).map(([key, value]) => <span key={key}>{key}: {value}</span>)}{Object.keys(event.cache).length === 0 && <span>Empty dictionary</span>}</div></div>}</div>
    <div className="playback-controls"><button className="secondary" onClick={() => playback.step(-1)} disabled={playback.index === 0} aria-label="Previous tree step">←</button><button onClick={() => { playback.toggle(); record('animation_played', { visualization: `${variant}-tree`, memoized }) }}>{playback.playing ? 'Pause' : 'Play trace'}</button><button className="secondary" onClick={() => { playback.step(1); record('animation_stepped', { visualization: `${variant}-tree`, memoized }) }} disabled={playback.index === trace.events.length - 1} aria-label="Next tree step">→</button><button className="text-button" onClick={playback.reset}>Reset</button></div>
    {selectedN !== null && <p className="small tree-selection" role="status">Highlighted: {functionName}({selectedN}). {trace.counts[selectedN]} {trace.counts[selectedN] === 1 ? 'call' : 'calls'} in this tree.</p>}
    {variant === 'stairs' && <p className="small muted">Each ways(n) node represents climb_stairs(n); the number below it is its returned count.</p>}
    <div className="tree-legend"><span>Waiting / not called</span><span className="legend-active">Current call</span><span className="legend-returned">Returned</span>{memoized && <span className="legend-cache">Cache hit</span>}</div>
  </section>
}
