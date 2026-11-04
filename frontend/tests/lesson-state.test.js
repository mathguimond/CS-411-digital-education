import test from 'node:test'
import assert from 'node:assert/strict'
import { lesson } from '../src/lessons/shared/content.js'
import { createLessonSession, hasResponse, canVisitPart, snapshotForSave } from '../src/lessons/shared/study/lessonState.js'
import { canVisitActivity } from '../src/lessons/shared/activities/activityPlan.js'

test('pre-test has five questions, unknown answers, and a conditional recursion explanation', () => {
  assert.equal(lesson.pretest.length, 5)
  const first = lesson.pretest[0]
  assert.equal(hasResponse(first, { 'recursion-awareness': 'no' }), true)
  assert.equal(hasResponse(first, { 'recursion-awareness': 'yes' }), false)
  assert.equal(hasResponse(first, { 'recursion-awareness': 'yes', 'recursion-before': 'Self-reference on smaller inputs.' }), true)
  assert.ok(lesson.pretest.slice(1).every((question) => question.options.some((option) => option.label === "I don't know")))
  assert.equal(lesson.pretest.at(-1).id, 'python-experience')
})

test('shared session has the new small traces and separate copied-editor stages', () => {
  const session = createLessonSession(lesson.version)
  assert.deepEqual(session.trees.stairs.nodes[0].args, ['4'])
  assert.deepEqual(session.trees.grid.nodes[0].args, ['2', '2'])
  assert.ok('transfer' in session.code && 'transferMemo' in session.code)
  assert.equal(lesson.activities[2].length, 1)
  assert.equal(lesson.activities[4][1].fields.length, 0)
  assert.equal(lesson.activities[4][2].fields.length, 0)
})

test('baseline stays locked and transfer activities can be revisited', () => {
  const session = createLessonSession(lesson.version)
  session.completedParts = [0, 1, 2, 3]
  session.pretestSubmitted = true
  session.transferStarted = true
  session.completedActivities = ['grid-components', 'grid-build']
  assert.equal(canVisitPart(session, 0), false)
  assert.equal(canVisitPart(session, 3), false)
  assert.equal(canVisitPart(session, 4), true)
  assert.equal(canVisitActivity(session, 4, 0), true)
  assert.equal(canVisitActivity(session, 4, 1), true)
  session.transferSubmitted = true
  assert.equal(canVisitPart(session, 5), true)
  assert.equal(canVisitPart(session, 4), false)
})

test('zero is a valid survey rating and event/history data use their separate database records', () => {
  assert.equal(hasResponse(lesson.questions['hint-helpfulness'], { 'hint-helpfulness': 0 }), true)
  assert.equal(hasResponse(lesson.questions['hint-helpfulness'], {}), false)
  const snapshot = snapshotForSave(createLessonSession(lesson.version))
  assert.equal(snapshot.events, undefined)
  assert.equal(snapshot.chatHistory, undefined)
  assert.equal(snapshot.hintUsage, undefined)
})
