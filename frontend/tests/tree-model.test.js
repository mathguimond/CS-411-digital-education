import test from 'node:test'
import assert from 'node:assert/strict'
import { addChild, assessCallTree, createCallTree, removeBranch, treeIsFilled, updateNode } from '../src/lessons/shared/visualizations/treeModel.js'

function completeTree(kind, expandedBases = false) {
  let tree = createCallTree(kind)
  function fill(id, args) {
    const [n, cols] = args
    const base = kind === 'stairs' ? n <= (expandedBases ? 0 : 1) : !n || !cols || (expandedBases ? n === 1 && cols === 1 : n === 1 || cols === 1)
    let value = kind === 'stairs' ? n < 0 ? 0 : 1 : !n || !cols ? 0 : 1
    if (!base) {
      value = 0
      for (const childArgs of kind === 'stairs' ? [[n - 1], [n - 2]] : [[n - 1, cols], [n, cols - 1]]) {
        tree = addChild(tree, id)
        value += fill(tree.nodes.at(-1).id, childArgs)
      }
    }
    tree = updateNode(tree, id, { args: args.map(String), value: String(value) })
    return value
  }
  fill('root', kind === 'stairs' ? [5] : [3, 3])
  return tree
}

test('constructed stairs tree counts repeated states and pending stack depth', () => {
  const result = assessCallTree(completeTree('stairs'))
  assert.equal(result.passed, true)
  assert.equal(result.calls, 15)
  assert.equal(result.counts['2'], 3)
  assert.equal(result.maxStackDepth, 5)
})

test('grid trees accept either direct one-axis bases or explicit empty-grid branches', () => {
  for (const expanded of [false, true]) {
    const tree = completeTree('grid', expanded)
    assert.equal(assessCallTree(tree).passed, true)
    assert.equal(tree.nodes[0].value, '6')
  }
  assert.equal(assessCallTree(completeTree('stairs', true)).passed, true)
})

test('a filled attempted tree can unlock progression without passing correctness', () => {
  let tree = createCallTree('stairs')
  tree = addChild(tree, 'root'); tree = addChild(tree, 'root')
  for (const node of tree.nodes) tree = updateNode(tree, node.id, { args: ['5'], value: '0' })
  assert.equal(treeIsFilled(tree), true)
  assert.equal(assessCallTree(tree).passed, false)
})

test('removing a branch removes descendants and dragging preserves logical checks', () => {
  let tree = completeTree('stairs')
  tree = updateNode(tree, 'root', { x: 300, y: 90 })
  assert.equal(assessCallTree(tree).passed, true)
  const child = tree.nodes[0].children[0]
  tree = removeBranch(tree, child)
  assert.equal(tree.nodes[0].children.length, 1)
  assert.equal(assessCallTree(tree).passed, false)
  assert.equal(tree.nodes.some((node) => node.parentId === child), false)
})
