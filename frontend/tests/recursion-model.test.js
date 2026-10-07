import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeTraceEvent, fibonacciTrace, stairsTrace, treeLayout } from '../src/lessons/shared/visualizations/recursionModel.js'

test('fib(4) illustrates repeated work and stack depth accurately', () => {
  const trace = fibonacciTrace(4)
  assert.equal(trace.result, 3)
  assert.equal(trace.calls, 9)
  assert.equal(trace.counts[2], 2)
  assert.equal(trace.maxStackDepth, 4)
  assert.deepEqual(trace.events.at(-1).stack, [])
  assert.equal(trace.events.at(-1).value, 3)
})

test('memoization reuses values and keeps the same result', () => {
  const trace = fibonacciTrace(4, { memoized: true })
  assert.equal(trace.result, 3)
  assert.equal(trace.calls, 7)
  assert.equal(trace.cacheHits, 2)
  assert.equal(trace.nodes.filter((node) => node.n === 2 && !node.cached).length, 1)
  assert.deepEqual(trace.events.at(-1).cache, { 0: 0, 1: 1, 2: 1, 3: 2, 4: 3 })
})

test('each base case terminates immediately', () => {
  for (const n of [0, 1]) {
    const trace = fibonacciTrace(n)
    assert.equal(trace.calls, 1)
    assert.equal(trace.result, n)
    assert.equal(trace.maxStackDepth, 1)
  }
})

test('tree positions put each parent above and between its children', () => {
  const trace = fibonacciTrace(4)
  const layout = treeLayout(trace.nodes)
  for (const node of trace.nodes.filter((entry) => entry.children.length)) {
    const parent = layout.positions[node.id]
    const [left, right] = node.children.map((id) => layout.positions[id])
    assert.ok(parent.y < left.y && parent.y < right.y)
    assert.equal(parent.x, (left.x + right.x) / 2)
  }
})

test('visualization inputs are bounded', () => {
  for (const n of [-1, 9, 2.5, '4']) assert.throws(() => fibonacciTrace(n), RangeError)
})

test('control reference uses stairs base values and labels while preserving the branching model', () => {
  const reference = stairsTrace(5)
  assert.equal(reference.result, 8)
  assert.equal(reference.calls, 15)
  assert.equal(reference.maxStackDepth, 5)
  assert.equal(reference.counts[2], 3)
  assert.equal(reference.counts[3], 2)
  assert.equal(stairsTrace(0).result, 1)
  assert.equal(stairsTrace(1).result, 1)
  assert.match(describeTraceEvent(reference.events.at(-1), 'climb_stairs'), /Return 8 from climb_stairs\(5\)/)
})
