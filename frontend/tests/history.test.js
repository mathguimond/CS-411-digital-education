import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recentHistory } from '../src/lib/api.js'

function turns(count, length = 10) {
  return Array.from({ length: count * 2 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: 'x'.repeat(length),
  }))
}

test('history keeps only the six most recent complete turns', () => {
  const messages = turns(10)
  messages[0].content = 'old message'
  const result = recentHistory(messages)
  assert.equal(result.length, 12)
  assert.deepEqual(result, messages.slice(-12))
  assert.equal(result[0].role, 'user')
})

test('history trims older turns to the total character limit', () => {
  const result = recentHistory(turns(6, 4000))
  assert.equal(result.length, 4)
  assert.equal(result.reduce((sum, entry) => sum + entry.content.length, 0), 16000)
})

test('first message needs no history', () => {
  assert.deepEqual(recentHistory([]), [])
})
