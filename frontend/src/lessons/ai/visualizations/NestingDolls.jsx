import usePlayback from './usePlayback.js'

const frames = [
  { depth: 1, returned: 0, caption: 'Start with the largest doll. The task is to discover what is inside.' },
  { depth: 2, returned: 0, caption: 'Open it: there is a smaller doll. The outer call waits while we solve the same problem on this smaller doll.' },
  { depth: 3, returned: 0, caption: 'The smaller doll contains another smaller doll. Each step makes progress toward a stopping point.' },
  { depth: 4, returned: 0, caption: 'One more smaller instance. The waiting calls form a stack.' },
  { depth: 5, returned: 0, caption: 'The smallest doll is solid. This is the base case: we can handle it directly, with no further recursive call.' },
  { depth: 4, returned: 1, caption: 'The base case returns. The next waiting call can now finish its work.' },
  { depth: 3, returned: 2, caption: 'Another result returns outward. The stack shrinks by one frame.' },
  { depth: 2, returned: 3, caption: 'Each waiting call resumes only after its smaller problem returns.' },
  { depth: 1, returned: 4, caption: 'The result is back at the original call. One final return finishes the task.' },
  { depth: 0, returned: 5, caption: 'Finished. A recursive process moves inward toward a base case, then returns outward.' },
]

function Doll({ number, status }) {
  const colors = ['#315a46', '#668358', '#b28c4b', '#cb8d63', '#ccaf82']
  const size = 128 - number * 15
  return <div className={`doll-slot ${status}`}>
    <svg width={size} height={size * 1.45} viewBox="0 0 100 145" role="img" aria-label={`Doll ${number + 1}, ${status}${number === 4 ? ', solid base case' : ''}`}>
      <path d="M50 4 C19 4 13 31 20 49 C5 74 3 110 10 126 C20 145 80 145 90 126 C97 110 95 74 80 49 C87 31 81 4 50 4Z" fill={colors[number]} />
      <ellipse cx="50" cy="34" rx="22" ry="24" fill="#f8e6c8" />
      <path d="M29 25 Q50 4 71 25 L66 13 Q50 1 34 13Z" fill={colors[number]} />
      <circle cx="43" cy="34" r="2" fill="#284536" /><circle cx="57" cy="34" r="2" fill="#284536" />
      <path d="M43 43 Q50 48 57 43" fill="none" stroke="#9b5c48" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="50" cy="101" rx="26" ry="28" fill="#fff5d9" opacity=".8" />
      <path d="M50 82 Q65 94 50 119 Q35 94 50 82" fill={colors[number]} /><path d="M32 101 Q50 91 68 101 Q50 112 32 101" fill={colors[number]} />
      {number < 4 && <path d="M13 70 Q50 79 87 70" fill="none" stroke="#f8e6c8" strokeWidth="2" strokeDasharray="4 3" />}
    </svg>
    <span className="doll-label">{number === 4 ? 'Solid doll' : `Doll ${number + 1}`}</span>
    <small>{status === 'waiting' ? 'Waiting' : status === 'active' ? 'Current call' : status === 'returned' ? 'Returned' : 'Not opened'}</small>
  </div>
}

export default function NestingDolls({ record }) {
  const playback = usePlayback(frames.length)
  const frame = frames[playback.index]
  return <section className="interactive-figure" aria-label="Nesting doll recursion animation">
    <div className="figure-heading"><span className="eyebrow">Explore · Recursion in two directions</span><span className="figure-counter">{playback.index + 1} / {frames.length}</span></div>
    <div className="dolls-scene">{Array.from({ length: 5 }, (_, number) => {
      const status = number >= 5 - frame.returned ? 'returned' : number === frame.depth - 1 ? 'active' : number < frame.depth ? 'waiting' : 'unopened'
      return <Doll key={number} number={number} status={status} />
    })}</div>
    <p className="animation-caption" role="status">{frame.caption}</p>
    <div className="doll-call-tree"><p className="eyebrow">Call stack · {frame.depth} {frame.depth === 1 ? 'frame' : 'frames'}</p>
      <svg viewBox="0 0 360 260" role="img" aria-label="Nesting doll call tree, one smaller call per doll">
        {Array.from({ length: 5 }, (_, number) => {
          const x = 125 + number * 22, y = 25 + number * 48
          const status = number >= 5 - frame.returned ? 'returned' : number === frame.depth - 1 ? 'active' : number < frame.depth ? 'waiting' : 'unopened'
          return <g key={number} className={`doll-tree-node ${status}`}>
            {number > 0 && <path className="tree-edge" d={`M ${x - 22} ${y - 30} L ${x} ${y - 18}`} />}
            <rect x={x - 82} y={y - 18} width="164" height="36" rx="8" />
            <text x={x} y={y + 4} textAnchor="middle">open(doll {number + 1}){status === 'returned' ? ' ✓' : ''}</text>
          </g>
        })}
      </svg><p className="small muted">Each doll makes one smaller call, so this call tree is a chain. The highlighted call is active; its ancestors are waiting. {frame.depth === 0 && 'All calls have returned.'}</p>
    </div>
    <div className="playback-controls"><button className="secondary" onClick={() => playback.step(-1)} disabled={playback.index === 0} aria-label="Previous animation step">←</button><button onClick={() => { playback.toggle(); record('animation_played', { visualization: 'nesting-dolls' }) }}>{playback.playing ? 'Pause' : 'Play animation'}</button><button className="secondary" onClick={() => { playback.step(1); record('animation_stepped', { visualization: 'nesting-dolls' }) }} disabled={playback.index === frames.length - 1} aria-label="Next animation step">→</button><button className="text-button" onClick={playback.reset}>Reset</button></div>
  </section>
}
