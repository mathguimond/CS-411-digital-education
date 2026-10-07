import { useEffect, useRef, useState } from 'react'
import { addChild, assessCallTree, removeBranch, TREE_HEIGHT, TREE_WIDTH, updateNode } from './treeModel.js'

export default function CallTreeBuilder({ tree, onChange, record, activityId, readOnly = false, assessment = false }) {
  const [selectedId, setSelectedId] = useState('root')
  const [feedback, setFeedback] = useState(null)
  const svg = useRef(null)
  const scroll = useRef(null)
  const drag = useRef(null)
  const selected = tree.nodes.find((node) => node.id === selectedId) || tree.nodes[0]
  const byId = new Map(tree.nodes.map((node) => [node.id, node]))
  const functionName = tree.kind === 'grid' ? 'unique_paths' : 'climb_stairs'

  useEffect(() => { scroll.current.scrollLeft = (TREE_WIDTH - scroll.current.clientWidth) / 2 }, [])

  function change(next) { setFeedback(null); onChange?.(next) }
  function point(event) {
    const value = svg.current.createSVGPoint()
    value.x = event.clientX; value.y = event.clientY
    return value.matrixTransform(svg.current.getScreenCTM().inverse())
  }
  function startDrag(event, node) {
    if (event.button !== 0) return
    setSelectedId(node.id)
    event.currentTarget.focus()
    if (readOnly) return
    event.preventDefault()
    const start = point(event)
    drag.current = { id: node.id, start, x: node.x, y: node.y, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function moveDrag(event) {
    if (!drag.current) return
    const next = point(event), current = drag.current
    const dx = next.x - current.start.x, dy = next.y - current.start.y
    current.moved ||= Math.abs(dx) + Math.abs(dy) > 3
    change(updateNode(tree, current.id, { x: Math.max(90, Math.min(TREE_WIDTH - 90, current.x + dx)), y: Math.max(35, Math.min(TREE_HEIGHT - 45, current.y + dy)) }))
  }
  function endDrag() {
    if (drag.current?.moved) record('tree_node_moved', { activityId, nodeId: drag.current.id })
    drag.current = null
  }
  function edit(changes) {
    change(updateNode(tree, selected.id, changes))
    record('tree_node_edited', { activityId, nodeId: selected.id })
  }
  function add() {
    const next = addChild(tree, selected.id)
    if (next === tree) return
    change(next)
    setSelectedId(next.nodes.at(-1).id)
    record('tree_child_added', { activityId, parentId: selected.id })
  }

  return <section className="interactive-figure tree-builder" aria-label={`${functionName} call tree builder`}>
    <div className="figure-heading"><span className="eyebrow">{readOnly ? 'Your saved call tree' : 'Construct your call tree'}</span><span className="figure-counter">{tree.nodes.length} calls</span></div>
    <p className="small muted">{readOnly ? 'Select a call to inspect your recorded inputs and return value.' : 'Select a call, add its children, and enter their inputs and return values. Drag calls to arrange them, or select a node and use arrow keys. Scroll to explore the canvas.'}</p>
    <div className="tree-scroll builder-canvas" ref={scroll}>
      <svg ref={svg} viewBox={`0 0 ${TREE_WIDTH} ${TREE_HEIGHT}`} style={{ width: TREE_WIDTH, minWidth: TREE_WIDTH }} role="group" aria-label="Draggable call tree canvas">
        {tree.nodes.filter((node) => node.parentId).map((node) => {
          const parent = byId.get(node.parentId)
          return <path key={node.id} d={`M ${parent.x} ${parent.y + 25} L ${node.x} ${node.y - 25}`} className="tree-edge visited" />
        })}
        {tree.nodes.map((node) => <g key={node.id} transform={`translate(${node.x}, ${node.y})`} className={`tree-node builder-node ${selected.id === node.id ? 'highlighted' : ''}`} role="button" tabIndex={0} aria-label={`Select call ${node.id === 'root' ? 'root' : tree.nodes.indexOf(node) + 1}: ${node.args.map((arg) => arg || '?').join(', ')}`} onPointerDown={(event) => startDrag(event, node)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(event) => {
          if (['Enter', ' '].includes(event.key)) { event.preventDefault(); setSelectedId(node.id) }
          if (!readOnly && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault(); setSelectedId(node.id)
            change(updateNode(tree, node.id, { x: Math.max(90, Math.min(TREE_WIDTH - 90, node.x + (event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0))), y: Math.max(35, Math.min(TREE_HEIGHT - 45, node.y + (event.key === 'ArrowUp' ? -10 : event.key === 'ArrowDown' ? 10 : 0))) }))
            record('tree_node_moved', { activityId, nodeId: node.id, keyboard: true })
          }
        }}>
          <rect x={tree.kind === 'grid' ? -72 : -52} y="-25" width={tree.kind === 'grid' ? 144 : 104} height="50" rx="10" />
          <text textAnchor="middle" y="-4">{node.args.map((arg) => arg || '?').join(', ')}</text><text textAnchor="middle" y="15">→ {node.value || '?'}</text>
        </g>)}
      </svg>
    </div>
    <div className="node-editor">
      <p className="small"><strong>{selected.id === 'root' ? 'Root call' : `Call ${tree.nodes.indexOf(selected) + 1}`}</strong> · {functionName}({selected.args.map((arg) => arg || '?').join(', ')})</p>
      <div className="prediction-fields">{selected.args.map((arg, index) => <div key={index}><label htmlFor={`${activityId}-arg-${index}`}>{tree.kind === 'grid' ? index === 0 ? 'Remaining rows' : 'Remaining columns' : 'Remaining stairs'}</label><input id={`${activityId}-arg-${index}`} type="number" value={arg} disabled={readOnly || selected.id === 'root'} onChange={(event) => edit({ args: selected.args.map((value, position) => position === index ? event.target.value : value) })} /></div>)}<div><label htmlFor={`${activityId}-return`}>Return value</label><input id={`${activityId}-return`} type="number" value={selected.value} disabled={readOnly} onChange={(event) => edit({ value: event.target.value })} /></div></div>
      {!readOnly && <div className="answer-actions"><button className="secondary" onClick={add} disabled={selected.children.length >= 2 || tree.nodes.length >= 63 || selected.depth >= 7}>Add child call</button><button className="text-button" disabled={selected.id === 'root'} onClick={() => { change(removeBranch(tree, selected.id)); setSelectedId('root'); record('tree_branch_removed', { activityId, nodeId: selected.id }) }}>Remove this branch</button></div>}
      {!assessment && !readOnly && <button className="secondary tree-check" onClick={() => { const result = assessCallTree(tree); setFeedback(result); record('tree_checked', { activityId, result }) }}>Check my tree</button>}
      {feedback && <div className="feedback-note" role="status">{feedback.passed ? 'Your tree checks passed.' : <><strong>Revisit these calls:</strong><ul>{feedback.issues.slice(0, 5).map((issue, index) => <li key={index}>Call {tree.nodes.findIndex((node) => node.id === issue.nodeId) + 1}: {issue.message}</li>)}</ul></>}</div>}
    </div>
  </section>
}
