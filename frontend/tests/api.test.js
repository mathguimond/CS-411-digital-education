import test from 'node:test'
import assert from 'node:assert/strict'
import { newParticipantToken, studyRequest } from '../src/lib/studyApi.js'

test('study API authenticates with a bearer token and never puts credentials in the URL', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/study/session')
    assert.equal(options.headers.Authorization, 'Bearer secret-token')
    assert.deepEqual(JSON.parse(options.body), { revision: 3 })
    return new Response(JSON.stringify({ revision: 4 }))
  })
  assert.equal((await studyRequest('/session', { token: 'secret-token', method: 'PUT', body: { revision: 3 } })).revision, 4)
})

test('API failures retain status and code without showing HTML gateway pages', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Hint limit reached', error_code: 'hint_limit' }), { status: 409 }))
  await assert.rejects(studyRequest('/hints'), (error) => error.status === 409 && error.code === 'hint_limit')
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Gateway failure</html>', { status: 502 }))
  await assert.rejects(studyRequest('/session'), /study server could not complete/)
})

test('network failures preserve retryable local work and tokens have 256 random bits', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network failed') })
  await assert.rejects(studyRequest('/session'), (error) => error.code === 'network_error')
  const first = newParticipantToken(), second = newParticipantToken()
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.notEqual(first, second)
})
