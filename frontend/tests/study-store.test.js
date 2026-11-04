import test from 'node:test'
import assert from 'node:assert/strict'
import { StudyStore } from '../src/lessons/shared/study/StudyStore.js'
import { lesson } from '../src/lessons/shared/content.js'

const memoryStorage = () => { const values = new Map(); return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) } }
const remote = () => ({ participant: { id: crypto.randomUUID(), condition: 'ai', lessonVersion: lesson.version }, snapshot: {}, revision: 0, hintUsage: {}, conversation: [], clock: { serverNow: new Date().toISOString(), startedAt: null, stoppedAt: null } })

test('a lost save response retries the same batch and preserves additional edits', async () => {
  const calls = [], storage = memoryStorage(), server = remote()
  const store = new StudyStore({ remote: server, token: 'test', storage, api: async (_path, { body }) => {
    calls.push(structuredClone(body))
    if (calls.length === 1) throw new Error('Lost response after commit')
    return { revision: calls.length - 1 }
  } })
  store.update((state) => ({ ...state, answers: { 'intro-base': 'First draft' } }))
  store.record('response_edited', { questionId: 'intro-base', value: 'First draft' })
  await assert.rejects(store.flush())
  store.update((state) => ({ ...state, answers: { 'intro-base': 'Second draft' } }))
  await store.flush()
  assert.equal(calls[0].id, calls[1].id)
  assert.equal(calls[2].snapshot.answers['intro-base'], 'Second draft')
  assert.equal(store.cache.queue.length, 0)
  assert.equal(store.cache.dirty, false)
})

test('a pending checkpoint survives reload and retries its original submission identifier', async () => {
  const storage = memoryStorage(), server = remote()
  let checkpointId
  const api = async (path, { body }) => {
    if (path === '/session') return { revision: 1 }
    checkpointId = body.id
    throw new Error('Submission accepted but response lost')
  }
  const first = new StudyStore({ remote: server, token: 'test', storage, api })
  await assert.rejects(first.checkpoint())
  const second = new StudyStore({ remote: server, token: 'test', storage, api: async (_path, { body }) => {
    assert.equal(body.id, checkpointId)
    return { ...server, revision: 2, snapshot: { ...body.snapshot, partIndex: 1, pretestSubmitted: true }, clock: { ...server.clock, startedAt: server.clock.serverNow } }
  } })
  await second.checkpoint()
  assert.equal(second.session.partIndex, 1)
  assert.equal(second.cache.pendingCheckpoint, null)
})

test('server-owned elapsed time continues in overtime and remains frozen after transfer', () => {
  const response = remote()
  response.clock.startedAt = new Date(Date.now() - 35 * 60000).toISOString()
  const store = new StudyStore({ remote: response, token: 'test', storage: memoryStorage() })
  assert.ok(store.elapsedMs() >= 35 * 60000)
  store.clock.stoppedAt = new Date(Date.parse(store.clock.startedAt) + 31 * 60000).toISOString()
  assert.equal(store.elapsedMs(), 31 * 60000)
})

test('a revision conflict preserves unsaved work and stops automatic overwrites', async () => {
  const store = new StudyStore({ remote: remote(), token: 'test', storage: memoryStorage(), api: async () => { const error = new Error('Another tab changed this lesson'); error.code = 'revision_conflict'; throw error } })
  store.update((state) => ({ ...state, answers: { 'intro-base': 'Keep this draft' } }))
  await assert.rejects(store.flush())
  assert.equal(store.blocked, true)
  assert.equal(store.session.answers['intro-base'], 'Keep this draft')
  assert.ok(store.cache.pendingBatch)
})

test('a response from an unmounted lesson cannot replace a newer local draft', async () => {
  const storage = memoryStorage(), response = remote()
  let finish
  const first = new StudyStore({ remote: response, token: 'test', storage, api: () => new Promise((resolve) => { finish = resolve }) })
  first.update((state) => ({ ...state, answers: { 'intro-base': 'Earlier draft' } }))
  const saving = first.flush()
  first.stop()
  const second = new StudyStore({ remote: response, token: 'test', storage })
  second.update((state) => ({ ...state, answers: { 'intro-base': 'Newer draft' } }))
  finish({ revision: 1 })
  await saving
  assert.equal(JSON.parse(storage.getItem(second.key)).session.answers['intro-base'], 'Newer draft')
})

test('reloading a conflicted tab restores server work without losing the old draft or its events', async () => {
  const storage = memoryStorage(), response = remote()
  const first = new StudyStore({ remote: response, token: 'test', storage, api: async () => { const error = new Error('Conflict'); error.code = 'revision_conflict'; throw error } })
  first.update((state) => ({ ...state, answers: { 'intro-base': 'Earlier unsent draft' } }))
  first.record('response_edited', { value: 'Earlier unsent draft' })
  await assert.rejects(first.flush())
  const second = new StudyStore({ remote: { ...response, revision: 2, snapshot: { answers: { 'intro-base': 'Newer server answer' } } }, token: 'test', storage, api: async (_path, { body }) => {
    assert.equal(body.snapshot.answers['intro-base'], 'Newer server answer')
    assert.equal(body.events[0].value, 'Earlier unsent draft')
    return { revision: 3 }
  } })
  assert.equal(second.session.answers['intro-base'], 'Newer server answer')
  assert.equal(JSON.parse(storage.getItem(`${second.key}:conflict-draft`)).session.answers['intro-base'], 'Earlier unsent draft')
  await second.flush()
})
