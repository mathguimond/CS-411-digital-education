function branchingTrace(n, { memoized = false } = {}, baseValues) {
  if (!Number.isInteger(n) || n < 0 || n > 8) {
    throw new RangeError('Choose a whole number from 0 to 8.')
  }
  const nodes = []
  const events = []
  const stack = []
  const cache = {}
  const counts = {}
  let cacheHits = 0

  function snapshot(type, node, value = null) {
    events.push({
      type, nodeId: node.id, n: node.n, value,
      stack: stack.map((frame) => ({ ...frame })),
      cache: { ...cache },
    })
  }

  function visit(input, parentId = null, branch = 'root') {
    const node = { id: parentId ? `${parentId}.${branch}` : 'root', parentId, n: input, depth: stack.length, children: [], result: null, cached: false }
    nodes.push(node)
    counts[input] = (counts[input] || 0) + 1
    stack.push({ nodeId: node.id, n: input })
    snapshot('enter', node)
    let value
    if (memoized && Object.hasOwn(cache, input)) {
      value = cache[input]
      node.cached = true
      cacheHits += 1
      snapshot('cache_hit', node, value)
    } else if (input < 2) {
      value = baseValues[input]
      snapshot('base', node, value)
    } else {
      const left = visit(input - 1, node.id, 'left')
      const right = visit(input - 2, node.id, 'right')
      node.children = [left.node.id, right.node.id]
      value = left.value + right.value
      snapshot('combine', node, value)
    }
    node.result = value
    if (memoized && !node.cached) {
      cache[input] = value
      snapshot('cache_store', node, value)
    }
    stack.pop()
    snapshot('return', node, value)
    return { node, value }
  }

  const { value } = visit(n)
  return { nodes, events, result: value, calls: nodes.length, counts, cacheHits, maxStackDepth: Math.max(...events.map((event) => event.stack.length)) }
}

export function fibonacciTrace(n, options) { return branchingTrace(n, options, [0, 1]) }
export function stairsTrace(n, options) { return branchingTrace(n, options, [1, 1]) }

export function treeLayout(nodes) {
  const positions = {}
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  let leafIndex = 0

  function place(node) {
    const children = node.children.map((id) => nodeMap.get(id))
    const x = children.length
      ? children.map((child) => place(child)).reduce((sum, value) => sum + value, 0) / children.length
      : leafIndex++ * 80 + 45
    positions[node.id] = { x, y: node.depth * 92 + 42 }
    return x
  }

  place(nodes[0])
  return { positions, width: Math.max(240, leafIndex * 80 + 10), height: Math.max(...nodes.map((node) => node.depth)) * 92 + 88 }
}

export function describeTraceEvent(event, functionName = 'fib') {
  switch (event.type) {
    case 'enter': return `Call ${functionName}(${event.n}). Add a frame to the stack.`
    case 'base': return `Base case: ${functionName}(${event.n}) returns ${event.value}. No smaller call is needed.`
    case 'combine': return `Both smaller calls have returned. Add their results: ${functionName}(${event.n}) = ${event.value}.`
    case 'cache_store': return `Save cache[${event.n}] = ${event.value} so the result can be reused.`
    case 'cache_hit': return `Cache hit: ${functionName}(${event.n}) is already ${event.value}. Reuse it without expanding another branch.`
    case 'return': return `Return ${event.value} from ${functionName}(${event.n}) and remove this frame from the stack.`
    default: return ''
  }
}
