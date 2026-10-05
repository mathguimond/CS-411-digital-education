import assert from 'node:assert/strict'
import { test } from 'node:test'
import { askTutor } from '../src/lib/api.js'

const request = { message: 'A hint please', history: [], stepId: 'setup-check' }

test('tutor request sends only the expected payload to the backend', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/ai/chat')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), {
      condition: 'ai', step_id: 'setup-check', message: 'A hint please', history: [],
    })
    return new Response(JSON.stringify({ reply: 'Find the stopping condition.' }))
  })
  assert.equal(await askTutor(request), 'Find the stopping condition.')
})

test('backend configuration errors become a readable UI error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({ error: 'Tutor is not configured.' }), { status: 503 },
  ))
  await assert.rejects(askTutor(request), /Tutor is not configured/)
})

test('HTML gateway errors do not leak into the UI', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Gateway error</html>', { status: 502 }))
  await assert.rejects(askTutor(request), /temporarily unavailable/)
})

test('network errors are readable and cancellation remains distinguishable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(askTutor(request), /Cannot reach the AI tutor/)
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Aborted', 'AbortError') })
  await assert.rejects(askTutor(request), { name: 'AbortError' })
})

test('an empty provider reply is not treated as a successful answer', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ reply: ' ' })))
  await assert.rejects(askTutor(request), /empty response/)
})
