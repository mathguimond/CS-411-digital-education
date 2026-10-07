export const TREE_WIDTH = 1440
export const TREE_HEIGHT = 780

export function createCallTree(kind) {
  return { kind, nodes: [{ id: 'root', parentId: null, children: [], depth: 0, args: kind === 'grid' ? ['3', '3'] : ['5'], value: '', x: TREE_WIDTH / 2, y: 45 }] }
}

export function addChild(tree, parentId) {
  const parent = tree.nodes.find((node) => node.id === parentId)
  if (!parent || parent.children.length >= 2 || tree.nodes.length >= 63 || parent.depth >= 7) return tree
  const id = crypto.randomUUID()
  const side = parent.children.length === 0 ? -1 : 1
  const node = { id, parentId, children: [], depth: parent.depth + 1, args: parent.args.map(() => ''), value: '', x: Math.max(90, Math.min(TREE_WIDTH - 90, parent.x + side * (320 / (2 ** parent.depth)))), y: Math.min(TREE_HEIGHT - 45, parent.y + 95) }
  return { ...tree, nodes: [...tree.nodes.map((item) => item.id === parentId ? { ...item, children: [...item.children, id] } : item), node] }
}

export function updateNode(tree, nodeId, changes) {
  return { ...tree, nodes: tree.nodes.map((node) => node.id === nodeId ? { ...node, ...changes } : node) }
}

export function removeBranch(tree, nodeId) {
  if (nodeId === 'root') return tree
  const removed = new Set([nodeId])
  for (const node of tree.nodes) if (removed.has(node.parentId)) removed.add(node.id)
  return { ...tree, nodes: tree.nodes.filter((node) => !removed.has(node.id)).map((node) => ({ ...node, children: node.children.filter((id) => !removed.has(id)) })) }
}

export function treeIsFilled(tree) {
  return tree.nodes.length >= 3 && tree.nodes.every((node) => node.args.every((arg) => String(arg).trim()) && String(node.value).trim())
}

export function treeStats(tree) {
  const counts = {}
  for (const node of tree.nodes) {
    const key = node.args.join(', ')
    counts[key] = (counts[key] || 0) + 1
  }
  return { calls: tree.nodes.length, maxStackDepth: Math.max(...tree.nodes.map((node) => node.depth + 1)), counts }
}

function stairsValue(n) {
  if (n < 0) return 0
  let previous = 1, current = 1
  for (let i = 2; i <= n; i++) [previous, current] = [current, previous + current]
  return current
}

function gridValue(rows, cols) {
  if (!rows || !cols) return 0
  const values = Array(cols).fill(1)
  for (let row = 1; row < rows; row++) for (let col = 1; col < cols; col++) values[col] += values[col - 1]
  return values[cols - 1]
}

export function assessCallTree(tree) {
  const issues = []
  const byId = new Map(tree.nodes.map((node) => [node.id, node]))
  for (const node of tree.nodes) {
    const args = node.args.map(Number)
    if (node.args.some((arg) => !String(arg).trim()) || args.some((arg) => !Number.isInteger(arg) || arg < (tree.kind === 'grid' ? 0 : -1) || arg > 12)) {
      issues.push({ nodeId: node.id, message: 'Enter valid whole-number call inputs for this small trace.' })
      continue
    }
    const expected = tree.kind === 'grid' ? gridValue(...args) : stairsValue(args[0])
    if (!String(node.value).trim() || Number(node.value) !== expected) issues.push({ nodeId: node.id, message: 'Recheck the return value of this call.' })
    let branches = []
    let mustExpand = false
    if (tree.kind === 'grid') {
      const [rows, cols] = args
      if (rows > 0 && cols > 0 && !(rows === 1 && cols === 1)) branches = [[rows - 1, cols], [rows, cols - 1]]
      mustExpand = rows > 1 && cols > 1
    } else {
      if (args[0] >= 1) branches = [[args[0] - 1], [args[0] - 2]]
      mustExpand = args[0] > 1
    }
    if (!node.children.length && !mustExpand) continue
    const actual = node.children.map((id) => byId.get(id)?.args.map(Number).join(',')).sort()
    if (actual.length !== 2 || actual.join('|') !== branches.map((branch) => branch.join(',')).sort().join('|')) {
      issues.push({ nodeId: node.id, message: branches.length ? 'Check both smaller calls and their input reductions.' : 'This base case should return without adding child calls.' })
    }
  }
  return { passed: issues.length === 0, issues, ...treeStats(tree) }
}
