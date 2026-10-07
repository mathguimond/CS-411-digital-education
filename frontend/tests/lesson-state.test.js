import test from 'node:test'
import assert from 'node:assert/strict'
import { createLessonSession, canVisitPart, cohortFlags, scorePretest, studyMetrics } from '../src/lessons/shared/study/lessonState.js'
import { learnerContext } from '../src/lessons/ai/hintContext.js'
import { ACTIVITIES, canVisitActivity } from '../src/lessons/shared/activities/activityPlan.js'

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

test('both conditions start with identical tasks and independent progress', () => {
  const ai = createLessonSession('test', 'ai')
  const control = createLessonSession('test', 'control', 'fixed-hints-v1')
  assert.equal(control.condition, 'control')
  assert.equal(ai.condition, 'ai')
  assert.equal(control.supportVersion, 'fixed-hints-v1')
  assert.notEqual(ai.sessionId, control.sessionId)
  for (const field of ['code', 'trees', 'answers', 'completedParts', 'completedActivities']) assert.deepEqual(ai[field], control[field])
  control.answers['intro-base'] = 'My control answer'
  assert.deepEqual(ai.answers, {})
})

test('study outcomes distinguish code errors, unoptimized runs, and assessment runs', () => {
  const session = createLessonSession('test')
  session.events = [
    { type: 'code_run_finished', activity: 'memoization', mode: 'test', result: { passed: false } },
    { type: 'code_run_finished', activity: 'memoization', mode: 'test', result: { passed: true } },
    { type: 'code_run_finished', activity: 'transfer', mode: 'run', result: { passed: true } },
    { type: 'chat_requested', supportMode: 'hints', requestKind: 'hint' },
    { type: 'chat_requested', supportMode: 'concept', requestKind: 'follow_up' },
  ]
  assert.equal(studyMetrics(session).unsuccessfulMemoizationRuns, 1)
  assert.equal(studyMetrics(session).transferCodeRuns, 1)
  assert.equal(studyMetrics(session).hintRequests, 1)
  assert.deepEqual(scorePretest([{ id: 'a', correct: 0 }, { id: 'b', correct: 1 }], { a: 0, b: 0 }), { score: 1, total: 2 })
})

test('new activities unlock only after a submitted attempt, independent of correctness', () => {
  const session = createLessonSession('test')
  assert.equal(canVisitActivity(session, 2, 1), false)
  session.completedActivities.push('stairs-design')
  assert.equal(canVisitActivity(session, 2, 1), true)
  assert.equal(canVisitActivity(session, 3, 2), false)
})

test('experience is a cohort flag and is excluded from the scored baseline', () => {
  const questions = [{ id: 'a', correct: 1 }, { id: 'memo-experience', correct: null }]
  const answers = { a: 1, 'memo-experience': 2 }
  assert.deepEqual(scorePretest(questions, answers), { score: 1, total: 1 })
  assert.deepEqual(cohortFlags(questions, answers), { priorIndependentMemoization: true, possiblePriorMastery: true })
})

test('hint context uses the active attempt and stays valid JSON within the API limit', () => {
  const session = createLessonSession('test'), activity = ACTIVITIES[2][0]
  session.code.stairs = 'x'.repeat(12000)
  session.answers['stairs-recurrence'] = 'y'.repeat(4000)
  session.lastResults.stairs = { passed: false, tests: [{ input: 5, expected: 8, actual: 0, error: 'z'.repeat(1000) }] }
  const raw = learnerContext(session, activity), context = JSON.parse(raw)
  assert.ok(raw.length <= 6000)
  assert.equal(context.activity.id, 'stairs-design')
  assert.equal(context.lastRun.tests[0].expected, 8)
  assert.equal(context.code.length, 2400)
  assert.equal(context.answers['stairs-recurrence'].length, 350)
})

test('process metrics distinguish hints, follow-ups, and next edits after feedback', () => {
  const session = createLessonSession('test')
  session.events = [
    { type: 'activity_entered', timestamp: '2026-10-07T10:00:00Z', activityId: 'stairs-design' },
    { type: 'chat_requested', requestKind: 'hint', activityId: 'stairs-design' },
    { type: 'chat_requested', requestKind: 'follow_up', activityId: 'stairs-design' },
    { type: 'chat_answered', timestamp: '2026-10-07T10:00:05Z', activityId: 'stairs-design' },
    { type: 'response_edited', timestamp: '2026-10-07T10:00:08Z', activityId: 'stairs-design' },
    { type: 'code_run_started', timestamp: '2026-10-07T10:00:10Z', activityId: 'stairs-design' },
  ]
  const metrics = studyMetrics(session)
  assert.equal(metrics.hintRequests, 1)
  assert.equal(metrics.activityTimeline['stairs-design'].followUpTurns, 1)
  assert.equal(metrics.activityTimeline['stairs-design'].firstRunMs, 10000)
  assert.deepEqual(metrics.activityTimeline['stairs-design'].feedbackToEditMs, [3000])
})

test('hint context prioritizes failing tests and includes structural and efficiency feedback', () => {
  const session = createLessonSession('test')
  session.code.memoization = '\u0001'.repeat(12000)
  session.lastResults.memoization = { passed: false, analysis: { dictionaryUsed: false }, efficiency: { passed: false, calls: 10001 }, tests: [
    { input: 0, expected: 1, actual: 1, passed: true },
    { input: 20, expected: 10946, actual: null, passed: false, error: 'More than 10,000 calls' },
  ] }
  const raw = learnerContext(session, ACTIVITIES[3][2]), context = JSON.parse(raw)
  assert.ok(raw.length <= 6000)
  assert.equal(context.lastRun.tests[0].input, 20)
  assert.equal(context.lastRun.efficiency.calls, 10001)
  assert.equal(context.lastRun.analysis.dictionaryUsed, false)
})

test('control hints and fallback solutions contribute to comparable process metrics', () => {
  const session = createLessonSession('test', 'control')
  session.events = [
    { type: 'hint_revealed', activityId: 'stairs-design', tier: 1, timestamp: '2026-10-07T10:00:05Z' },
    { type: 'hint_revealed', activityId: 'stairs-design', tier: 2, timestamp: '2026-10-07T10:00:08Z' },
    { type: 'solution_revealed', activityId: 'stairs-design', timestamp: '2026-10-07T10:00:10Z' },
    { type: 'code_edited', activityId: 'stairs-design', timestamp: '2026-10-07T10:00:14Z' },
  ]
  const metrics = studyMetrics(session)
  assert.equal(metrics.hintRequests, 2)
  assert.equal(metrics.fixedHintsOpened, 2)
  assert.equal(metrics.fallbackSolutionsDisplayed, 1)
  assert.equal(metrics.aiInteractionTurns, 0)
  assert.equal(metrics.activityTimeline['stairs-design'].fallbackDisplayed, true)
  assert.deepEqual(metrics.activityTimeline['stairs-design'].feedbackToEditMs, [4000])
})
