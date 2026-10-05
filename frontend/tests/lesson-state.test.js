import test from 'node:test'
import assert from 'node:assert/strict'
import { createLessonSession, canVisitPart, scorePretest, studyMetrics } from '../src/lessons/ai/study/lessonState.js'

test('assessment order locks the baseline and earlier parts during transfer', () => {
  const session = createLessonSession('test')
  assert.equal(canVisitPart(session, 1), false)
  session.completedParts = [0, 1, 2, 3]
  session.pretestSubmitted = true
  assert.equal(canVisitPart(session, 0), false)
  assert.equal(canVisitPart(session, 2), true)
  session.transferStarted = true
  assert.equal(canVisitPart(session, 2), false)
  assert.equal(canVisitPart(session, 4), true)
})

test('study outcomes distinguish code errors, unoptimized runs, and assessment runs', () => {
  const session = createLessonSession('test')
  session.events = [
    { type: 'code_run_finished', activity: 'memoization', mode: 'test', result: { passed: false } },
    { type: 'code_run_finished', activity: 'memoization', mode: 'test', result: { passed: true } },
    { type: 'code_run_finished', activity: 'transfer', mode: 'run', result: { passed: true } },
    { type: 'chat_requested', supportMode: 'hints' },
    { type: 'chat_requested', supportMode: 'concept' },
  ]
  assert.equal(studyMetrics(session).unsuccessfulMemoizationRuns, 1)
  assert.equal(studyMetrics(session).transferCodeRuns, 1)
  assert.equal(studyMetrics(session).hintRequests, 1)
  assert.deepEqual(scorePretest([{ id: 'a', correct: 0 }, { id: 'b', correct: 1 }], { a: 0, b: 0 }), { score: 1, total: 2 })
})
